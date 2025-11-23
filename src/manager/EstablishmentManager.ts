import { Socket } from "socket.io";
import { io } from "../server.js";
import { authSocketManager } from "./socketManager.js";
import { cancelTasks, DAY_TO_MILISECONDS, getTimeTo, registerTask } from "./scheduleTaskManager.js";

enum weekDays {
    sunday = 1,
    monday = 2,
    tuesday = 3,
    wednesday = 4,
    thursday = 5,
    friday = 6,
    saturday = 7
}

let week = {
    sunday: {
        start: '18:20',
        end: '23:40'
    },
    monday: null,
    tuesday: {
        start: '00:20',
        end: '23:40'
    },
    wednesday: {
        start: '00:20',
        end: '23:40'
    },
    thursday: {
        start: '00:20',
        end: '23:40'
    },
    friday: {
        start: '00:20',
        end: '23:40'
    },
    saturday: {
        start: '00:20',
        end: '23:40'
    },
}

let time = {
    waitingTime: '00:30',
    timeDelivery: '00:45'
}

let open = false

let today = week[getWeekDayByDayValue(new Date().getDay() + 1)]

//console.log(getWeekDayByDayValue(new Date().getDay() + 1), today)

function getWeekDayByDayValue(dayValue: number) {
    return Object.entries(weekDays).find(([key, value]) => value === dayValue)?.[0]
}

function scheduleOpenAndCloseEstablishment() {
    cancelTasks(['open', 'close'])

    const taskStart = registerTask(() => {
        setOpenAndNotify(true)
    }, today?.start, 'open')

    const taskClose = registerTask(() => {
        setOpenAndNotify(false)
    }, today?.end, 'close')
}

scheduleOpenAndCloseEstablishment()

setTimeout(() => {
    setInterval(() => {
        today = week[getWeekDayByDayValue(new Date().getDay() + 1)]
        scheduleOpenAndCloseEstablishment()
    }, DAY_TO_MILISECONDS)
}, getTimeTo('24:00'))

function setOpenAndNotify(o: boolean) {
    open = o
    socketAuth.emitToRoles(['guest', 'admin'], 'establishment_open', open)
}

const socketAuth = authSocketManager(io);

socketAuth.onConnectByRole(['guest', 'admin'], (socket: Socket) => {
    socket.emit('establishment_open', open)
    socket.emit('time', time)
    socket.emit('week', week)
})

socketAuth.onSecure({
    eventName: 'toggle_establishment_open',
    rolesAllowed: ['admin'],
    emitToRoles: ['admin'],
    handler: (socket) => {
        open = !open
        socketAuth.emitToRoles(['guest', 'admin'], 'establishment_open', open)
    }
})

socketAuth.onSecure({
    eventName: 'set_time',
    rolesAllowed: ['admin'],
    emitToRoles: ['admin'],
    handler: (socket, time_) => {
        time = time_
        socketAuth.emitToRoles(['guest', 'admin'], 'time', time)
    }
})

socketAuth.onSecure({
    eventName: 'set_open_by_week_day',
    rolesAllowed: ['admin'],
    emitToRoles: ['admin'],
    handler: (socket, weekDay, state) => {
        if (state == false) {
            week[weekDay] = null
        } else {
            week[weekDay] = {
                start: '00:00',
                end: '23:59'
            }
        }

        scheduleOpenAndCloseEstablishment()
        socketAuth.emitToRoles(['admin'], 'week', week)
    }
})


socketAuth.onSecure({
    eventName: 'set_time_start_to_weekday',
    rolesAllowed: ['admin'],
    emitToRoles: ['admin'],
    handler: (socket, weekDay, time) => {
        const day = week[weekDay]
        if (day) {
            day.start = time
            scheduleOpenAndCloseEstablishment()
            socketAuth.emitToRoles(['admin'], 'week', week)
        }
    }
})

socketAuth.onSecure({
    eventName: 'set_time_end_to_weekday',
    rolesAllowed: ['admin'],
    emitToRoles: ['admin'],
    handler: (socket, weekDay, time) => {
        const day = week[weekDay]

        if (day) {
            day.end = time
            scheduleOpenAndCloseEstablishment()
            socketAuth.emitToRoles(['admin'], 'week', week)
        }
    }
})