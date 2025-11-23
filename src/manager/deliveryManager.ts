import { io, stomp } from "../server.js"
import { realtimeDate } from "./orderManager.js"
import { authSocketManager } from "./socketManager.js"

let deliveries: any[] = []
let drivers: { name: string, acc: number, totalDelivery: number }[] = []

const socketAuth = authSocketManager(io)

function saveDelivery(delivery: any) {
    let index = deliveries.findIndex(d => d.id === delivery.id)

    if (index != -1) {
        deliveries[index] = delivery
    } else {
        deliveries.push(delivery)
    }

    socketAuth.emitToRoles(['admin', 'drivers'], 'deliveries', deliveries)
}

function getDriverPropertis() {
    let driversName = [...new Set<String>(deliveries.map(d => d.driver))]
    let drivers = driversName.map(name => ({ name: name, acc: 0, totalDelivery: 0 }))
    deliveries.forEach(delivery => {
        let driver = drivers.find(d => d.name === delivery.name)
        if (delivery.status === "COMPLETED") {
            driver.acc += delivery.address.valueDelivery;
            driver.totalDelivery += 1;
        }
    })
    return drivers
}

function registerDeliveryStomp() {
    stomp.publish({
        destination: '/app/send/deliveries/byDate',
        body: JSON.stringify({ date: realtimeDate })
    })

    stomp.subscribe('/topic/deliveries/', (message) => {
        deliveries = JSON.parse(message.body)
    })

    stomp.subscribe('/topic/deliveries/add', (message) => {
        saveDelivery(JSON.parse(message.body))
    })
}

socketAuth.onSecure({
    eventName: 'register_driver',
    rolesAllowed: ['admin'],
    emitToRoles: [],
    handler: (socket, driver) => {
        let index = drivers.findIndex(d => d.name === driver)
        if (index === -1) {
            drivers.push({
                name: driver,
                acc: 0,
                totalDelivery: 0
            })
        }
    }
})

export { registerDeliveryStomp }