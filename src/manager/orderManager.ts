import { DefaultEventsMap, Server, Socket } from "socket.io";
import { Order } from "../model/order.js";
import { io, stomp } from "../server.js";
import { formatarData, timeToDate } from "../utils.js";
import { authSocketManager } from "./socketManager.js";

let realtimeDate = formatarData(new Date())
let orders: Order[] = []
let ordersWorks: { id: string, order: any }[] = []
let newOrders: Order[] = []

const socketAuth = authSocketManager(io);

function saveOrder(order: Order) {
    let index = orders.findIndex(o => o.id === order.id)

    if (index != -1) {
        orders[index] = order
    } else {
        if (formatarData(new Date(order.dateCreation)) === realtimeDate) {
            orders.push(order)
        }
        newOrders.push(order)
        socketAuth.emitToRoles(['admin'], 'new_orders', newOrders)
        socketAuth.emitToRoles(['admin'], 'notification', { title: 'Novo pedido', body: `Você tem ${newOrders.length} ainda não visualizadas` })
    }

    saveAndEmitOrderWorkerByOrder(order)

    socketAuth.emitToRoles(['admin'], 'orders', orders)
}

function saveAndEmitOrderWorkerByOrder(order) {
    let index = ordersWorks.findIndex(w => w.order.id === order.id)

    if (index != -1) {
        ordersWorks[index].order = order
        io.to(ordersWorks[index].id).emit("change_order_worker", order)
        console.log("alterado", order.id , ordersWorks.length)
    }
}

function removerNewOrder(id: number) {
    let index = newOrders.findIndex(no => no.id === id)
    if (index != -1) {
        newOrders.splice(index, 1)
        socketAuth.emitToRoles(['admin'], 'new_orders', newOrders)
    }
}


function registerOrderStomp() {
    stomp.publish({
        destination: "/app/send/orders/ByDate",
        body: JSON.stringify({ date: realtimeDate })
    });

    stomp.subscribe('/topic/orders', (message) => {
        orders = JSON.parse(message.body)
        socketAuth.emitToRoles(['admin'], 'orders', orders)
    })

    stomp.subscribe('/topic/orders/add', (message) => {
        saveOrder(JSON.parse(message.body))
    })
}

socketAuth.onConnectByRole(['admin'], (socket: Socket) => {
    socket.emit("current_date", realtimeDate)
    socket.emit("orders", orders)
    socket.emit("new_orders", newOrders)

    console.log("Conectou", socket.id, socket.data)
})

socketAuth.onConnectByRole(['guest'], (socket: Socket) => {
    socket.emit("current_date", realtimeDate)
})

socketAuth.onDesconnectByRole(['guest'], (socket: Socket) => {
    ordersWorks = ordersWorks.filter(work => work.id != socket.id)
})


socketAuth.onSecure({
    eventName: 'set_current_date',
    emitToRoles: ['admin'],
    rolesAllowed: ['admin'],
    handler: (socket, data) => {
        let date

        if (typeof data === 'number') {
            date = formatarData(timeToDate(data))
        } else {
            date = data
        }

        const [ano, mes, dia] = date.split('-').map(Number);
        realtimeDate = formatarData(new Date(ano, mes - 1, dia))

        stomp.publish({
            destination: "/app/send/orders/byDate",
            body: JSON.stringify({ date: realtimeDate })
        });

        socketAuth.emitToRoles(['admin'], 'current_date', realtimeDate)
    }
})

socketAuth.onSecure({
    eventName: 'remover_new_order',
    emitToRoles: ['admin'],
    rolesAllowed: ['admin'],
    handler: (socket, id) => {
        removerNewOrder(id)
    }
})

socketAuth.onSecure({
    eventName: 'register_orders_works',
    emitToRoles: ['admin', 'guest'],
    rolesAllowed: ['admin', 'guest'],
    handler: (socket, orders: any[]) => {
        for (let o of orders) {
            let index = ordersWorks.findIndex(w => w.order.id == o.id)

            if (index != -1) {
                ordersWorks[index].order = o
            } else {
                ordersWorks.push({ id: socket.id, order: o })
            }
        }
    }
})


export {
    registerOrderStomp,
    realtimeDate
}
