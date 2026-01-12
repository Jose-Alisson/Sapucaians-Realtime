import { Socket } from "socket.io"
import { Order } from "../../model/order.js"
import { io, stomp } from "../../server.js"
import { secureManager } from "../socketManager.js"
import chalk from "chalk"
import fs from 'fs'
import path from "path"
import { fileURLToPath } from "url"
import { cancelTasks, DAY_TO_MILISECONDS, getTimeTo, getTimeToWithLasted, registerTask } from "../scheduleTaskManager.js"
import { DateTime } from "luxon"
import { formatDate } from "../../utils.js"

enum weekDays {
    sunday = 1,
    monday = 2,
    tuesday = 3,
    wednesday = 4,
    thursday = 5,
    friday = 6,
    saturday = 7
}

export class Establishment {
    public secure: any

    public id: number

    public name: string
    public active: boolean
    public files: Map<string, string> = new Map<string, string>()

    public orders: any[] = []
    public newOrders: any[] = []
    private baseDateOrders = DateTime.now().startOf('day')

    public time: { waitingTime: string, timeDelivery: string } = {
        waitingTime: "00:00",
        timeDelivery: "00:00"
    }

    week = {
        sunday: null,
        monday: null,
        tuesday: {
            start: '00:00',
            end: '23:59'
        },
        wednesday: {
            start: '00:00',
            end: '23:59'
        },
        thursday: {
            start: '00:00',
            end: '23:59'
        },
        friday: {
            start: '00:00',
            end: '23:59'
        },
        saturday: {
            start: '00:00',
            end: '23:59'
        },
    }

    private today

    constructor(establishment) {
        this.id = establishment.id
        this.name = establishment.name
        this.active = establishment.active
        this.orders = establishment.orders || []
        this.newOrders = establishment.newOrders || []

        this.readWeekFromDisk()

        this.scheduleOpenAndCloseEstablishment()

        setTimeout(() => {
            setInterval(() => {
                this.today = this.week[this.getWeekDayByDayValue(new Date().getDay() + 1)]
                this.scheduleOpenAndCloseEstablishment()
            }, DAY_TO_MILISECONDS)
        }, getTimeTo('24:00'))
    }

    public async saveWeekToDisk() {
        let caminho = path.join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..", "week", this.name + ".json")

        await fs.mkdirSync(path.dirname(caminho), { recursive: true })
        await fs.writeFileSync(caminho, JSON.stringify(this.week));
    }

    public async readWeekFromDisk() {
        let caminho = path.join(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..", "week", this.name + ".json")

        if (fs.existsSync(path.dirname(caminho))) {
            const data = fs.readFileSync(caminho, 'utf8');
            this.week = JSON.parse(data)
            return this.week
        }
    }

    private getWeekDayByDayValue(dayValue: number) {
        return Object.entries(weekDays).find(([key, value]) => value === dayValue)?.[0]
    }

    public scheduleOpenAndCloseEstablishment() {
        this.today = this.week[this.getWeekDayByDayValue(new Date().getDay() + 1)]

        cancelTasks([`${this.name}_open`, `${this.name}_close`])

        const taskStart = registerTask(() => {
            if (getTimeToWithLasted(this.today?.start) >= -60000) {
                this.setOpenAndNotify(true)
            }
        }, this.today?.start, `${this.name}_open`)

        const taskClose = registerTask(() => {
            if (getTimeToWithLasted(this.today?.start) >= -60000) {
                this.setOpenAndNotify(false)
            }
        }, this.today?.end, `${this.name}_close`)

        this.saveWeekToDisk()
    }


    setBaseDateOrders(date: DateTime) {
        this.baseDateOrders = date.startOf('day')
        console.log(chalk.cyan(`Base date for orders of establishment ${this.name} set to ${this.baseDateOrders.toISODate()}`))
    }

    private setOpenAndNotify(o: boolean) {
        this.active = o
        this.secure?.emitToRoles(['guest_' + this.name, this.name], 'establishment_open', this.active)
    }

    orderManager = () => {
        return {
            save: (order: Order) => {
                let index = this.orders.findIndex(o => o.id === order.id)

                if (index != -1) {
                    this.orders[index] = order
                } else {

                    if (formatDate(order.dateCreation).date() === formatDate(this.baseDateOrders.toISO()).date()) {
                        console.log(chalk.yellow(`Adding order ${order.id} to establishment ${this.name}`))
                        this.orders.push(order)
                    }

                    console.log(formatDate(order.dateCreation).date() === formatDate(this.baseDateOrders.toISO()).date())

                    this.newOrders.push(order)

                    this.secure?.emitToRoles([this.name], 'new_orders', this.newOrders)
                    this.secure?.emitToRoles([this.name], 'notification', { title: 'Novo pedido', body: `Você tem ${this.newOrders.length} ainda não visualizadas` })
                }

                this.secure?.emitToRoles([this.name], 'orders', this.orders)
            },
            removerNewOrder: (id: number) => {
                let index = this.newOrders.findIndex(no => no.id === id)
                if (index != -1) {
                    this.newOrders.splice(index, 1)
                    this.secure?.emitToRoles([this.name], 'new_orders', this.newOrders)
                }
            },
            send: () => {
                this.secure?.emitToRoles([this.name], 'orders', this.orders)
            }
        }
    }
}

let establishments: Establishment[] = []

function saveEstablishment(establishmentData: Establishment) {
    let index = establishments.findIndex(e => e.name === establishmentData.name)

    if (index != -1) {
        establishmentData.orders = establishments[index].orders
        establishmentData.newOrders = establishments[index].newOrders
        establishments[index] = new Establishment(establishmentData)
    } else {
        establishments.push(new Establishment(establishmentData))
    }
}

export function registerV2EstablishmentAndOrderManagerStomp() {
    console.log(chalk.green.bold("Registering V2 Establishment And Order Manager Stompv"))

    stomp.publish({
        destination: '/app/send/establishments/read'
    })

    let today = DateTime.now().toFormat('yyyy-MM-dd')

    stomp.publish({
        destination: '/app/send/orders/read',
        body: JSON.stringify({ start: today, end: today, considered: true })
    })

    stomp.subscribe('/user/queue/establishments/read', (message) => {

        establishments = Array.from(JSON.parse(message.body)).map(e => new Establishment(e))

        console.log(chalk.blue.bold(establishments.map(e => e.name).join(', ')))

        establishments.forEach(establishment => {
            let name = establishment.name
            let secure = secureManager(name);
            establishment.secure = secure

            if (!secure.hasHandlerDefined('connect', [name])) {
                secure.onConnectByRole([name], (socket: Socket) => {
                    socket.emit('orders', establishment.orders || [])
                    socket.emit('new_orders', establishment.newOrders || [])
                    socket.emit('time', establishment.time)
                    socket.emit('week', establishment.week)
                    socket.emit('establishment_open', establishment.active)
                })
            }

            if (!secure.hasHandlerDefined('connect', ["guest_" + name])) {
                secure.onConnectByRole(["guest_" + name], (socket: Socket) => {
                    socket.emit('time', establishment.time)
                    socket.emit('week', establishment.week)
                    socket.emit('establishment_open', establishment.active)
                })
            }

            secure.onSecure({
                eventName: 'remove_new_order',
                rolesAllowed: [name],
                handler: (socket, orderId: number) => {
                    establishment.orderManager().removerNewOrder(orderId)
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'toggle_establishment_open',
                rolesAllowed: [name],
                handler: (socket) => {
                    establishment.active = !establishment.active
                    secure.emitToRoles(['guest_' + name, name], 'establishment_open', establishment.active)
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'set_time',
                rolesAllowed: [name],
                handler: (socket, time_) => {
                    establishment.time = time_
                    secure.emitToRoles(['guest_' + name, name], 'time', establishment.time)
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'set_open_by_week_day',
                rolesAllowed: [name],
                handler: (socket, weekDay, state) => {
                    if (state == false) {
                        establishment.week[weekDay] = null
                    } else {
                        establishment.week[weekDay] = {
                            start: '00:00',
                            end: '23:59'
                        }
                    }

                    establishment.scheduleOpenAndCloseEstablishment()
                    secure.emitToRoles([name], 'week', establishment.week)
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'set_time_start_to_weekday',
                rolesAllowed: [name],
                handler: (socket, weekDay, time) => {
                    const day = establishment.week[weekDay]
                    if (day) {
                        day.start = time
                        establishment.scheduleOpenAndCloseEstablishment()
                        secure.emitToRoles([name], 'week', establishment.week)
                    }
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'set_time_end_to_weekday',
                rolesAllowed: [name],
                handler: (socket, weekDay, time) => {
                    const day = establishment.week[weekDay]

                    if (day) {
                        day.end = time
                        establishment.scheduleOpenAndCloseEstablishment()
                        secure.emitToRoles([name], 'week', establishment.week)
                    }
                }, rewrite: true
            })

            secure.onSecure({
                eventName: 'load_orders_where_beetween_date_and_canceled_can_be_considered',
                rolesAllowed: [name],
                handler: (socket, start, end, considered, store) => {
                    console.log(chalk.magenta(`Loading orders from ${start} to ${end} | Canceled considered: ${considered} | Store: ${store}`))
                    establishment.setBaseDateOrders(DateTime.fromISO(start))

                    stomp.publish({
                        destination: '/app/send/orders/read',
                        body: JSON.stringify({ start: start, end: end, considered: considered, store: store })
                    })
                }, rewrite: true
            })
        })
    })

    stomp.subscribe('/topic/establishment/save', (message) => {
        saveEstablishment(JSON.parse(message.body))
    })

    stomp.subscribe('/user/queue/establishment/save', (message) => {
        saveEstablishment(JSON.parse(message.body))
    })

    stomp.subscribe('/topic/orders/add', (message) => {
        let order = JSON.parse(message.body)
        findEstablishmentByName(order.store).orderManager().save(order)
    })

    stomp.subscribe('/user/queue/orders/read', (message) => {
        let orders = Array.from(JSON.parse(message.body))

        let group = orders.reduce((acc, order) => {
            let key = order?.['store']
            if (!acc[key]) {
                acc[key] = []
            }
            acc[key].push(order)
            return acc
        }, {})

        establishments.forEach(establishment => {
            establishment.orders = group[establishment.name] || []
            establishment.orderManager().send()
        })
    })
}

function findEstablishmentByName(name: string) {
    return establishments.find(e => e.name === name);
}