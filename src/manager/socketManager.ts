import { Server, Socket } from "socket.io";
import { io } from "../server.js";

function emitToRoles(io: Server, authorities = [], eventName, data) {
    if (!Array.isArray(authorities)) {
        authorities = [authorities]; // transforma em array automaticamente
    }

    const sockets = Array.from(io.sockets.sockets.values());

    for (const socket of sockets) {
        const authoritiesSocket = socket.data.user?.authorities || ['guest'];

        if (authoritiesSocket.some(a => authorities.includes(a))) {
            socket.emit(eventName, data);
        }
    }
}


let listSecureManager = new Map<string, Function>()

io.on('connection', (socket: Socket) => {
    listSecureManager.get(socket.data.to)?.(socket)
})

function secureManager(base: string) {
    const registeredEvents = [];
    const roleConnectHandlers = {};
    const roleDisconnectHandlers = {}

    listSecureManager.set(base, (socket: Socket) => {

        const authorities = socket.data.user?.authorities || ['guest'];

        const entries = Object.entries(roleConnectHandlers)
        let handles = entries.filter(([key, value]) => authorities.some((authoritie) => key === authoritie)).map<any>(handle => { return handle[1] })

        handles.forEach((handlers) => {
            if (Array.isArray(handlers)) {
                handlers.forEach(fn => fn(socket))
            } else if (handlers instanceof Function) {
                handlers(socket)
            }
        })

        for (const evt of registeredEvents) {

            if (evt.rolesAllowed.some(au => authorities.includes(au))) {
                socket.on(evt.eventName, async (...data) => {
                    const result = await evt.handler(socket, ...data);

                    // if (evt.autoEmitToRoles) {
                    //     if (evt.emitToOwnSocket) {
                    //         // Emite apenas para o próprio socket
                    //         socket.emit(evt.eventName, result);
                    //     } else if (evt.emitToRoles.length > 0) {
                    //         // Emite para as roles definidas
                    //         emitToRoles(io, evt.emitToRoles, evt.eventName, result);
                    //     }
                    // }
                });
            }
        }

        socket.on('disconnect', () => {
            const entries = Object.entries(roleDisconnectHandlers)

            let handles = entries.filter(([key, value]) => authorities.some((authoritie) => key === authoritie)).map<any>(handle => handle[1])

            handles.forEach(values => {
                values.forEach(fn => fn(socket, socket.data.user.sub))
            })
        })
    })
    return {
        /**
         * Registra evento com controle de roles
         */
        onSecure: ({ eventName, handler, rolesAllowed = ['guest'], emitToRoles = [], rewrite = false }) => {
            if(rewrite){
                let index = registeredEvents.findIndex(events => events.eventName === eventName)

                if(index != -1){
                    registeredEvents[index] = { eventName, handler, rolesAllowed, emitToRoles }
                    return
                }
            }
            registeredEvents.push({ eventName, handler, rolesAllowed, emitToRoles });
        },

        /**
         * Emite evento apenas para sockets com determinadas roles
         */
        emitToRoles: (roles, eventName, data) => {
            emitToRoles(io, roles, eventName, data);
        },

        onDesconnectByRole: (authorities, fn) => {
            if (!Array.isArray(authorities)) authorities = [authorities];
            for (const authoritie of authorities) {
                if (!roleDisconnectHandlers[authoritie]) {
                    roleDisconnectHandlers[authoritie] = [];
                }
                roleDisconnectHandlers[authoritie].push((fn));
            }
        },

        /** <-- NOVO: dispara eventos ao conectar por role */
        onConnectByRole: (authorities, fn) => {
            if (!Array.isArray(authorities)) authorities = [authorities];
            for (const authoritie of authorities) {
                if (!roleConnectHandlers[authoritie]) {
                    roleConnectHandlers[authoritie] = [];
                }
                roleConnectHandlers[authoritie].push(fn);
            }
        },

        hasHandlerDefined: (type: 'events' | 'connect' | 'disconnect', names: string[]) => {
            switch (type) {
                case 'events':
                    return registeredEvents.some((e) => names.includes(e.eventName))

                case 'connect':
                    return Object.keys(roleConnectHandlers).some((key) => names.includes(key))

                case 'disconnect':
                    return Object.keys(roleDisconnectHandlers).some((key) => names.includes(key))

                default:
                    return false
            }
        }
    };
}

export {
    secureManager
}
