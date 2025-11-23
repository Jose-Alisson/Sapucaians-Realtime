import { Server, Socket } from "socket.io";

function emitToRoles(io: Server, authorities = [], eventName, data) {
    if (!Array.isArray(authorities)) {
        authorities = [authorities]; // transforma em array automaticamente
    }

    const sockets = Array.from(io.sockets.sockets.values());

    for (const socket of sockets) {
        const authorities = socket.data.user?.authorities || ['guest'];
        if (authorities.some(a => authorities.includes(a))) {
            socket.emit(eventName, data);
        }
    }
}

function authSocketManager(io: Server) {
    const registeredEvents = [];
    const roleConnectHandlers = {}; // <-- NOVO
    const roleDisconnectHandlers = {}

    io.on('connection', (socket: Socket) => {
        const authorities = socket.data.user?.authorities || ['guest'];

        // // Executa todas as funções registradas para a role do socket
        // const fns = roleConnectHandlers[authorities] || [];

        const entries = Object.entries(roleConnectHandlers)
        // entries.filter(([key, value]) => authorities.some((authority) => key === authority)).forEach(([key, fn]) => fn(socket))

        let handles = entries.filter(([key, value]) => authorities.some((authoritie) => key === authoritie))
            .map<any>(handle => {
                return handle[1]
            })
        handles.forEach((handlers) => {
            if (Array.isArray(handlers)) {
                handlers.forEach(fn => fn(socket))
            } else if (handlers instanceof Function) {
                handlers(socket)
            }
        })

        // fns.forEach(fn => fn(socket));

        // Registra handlers para este socket

        // console.log(registeredEvents)


        for (const evt of registeredEvents) {

            if (evt.rolesAllowed.some(au => authorities.includes(au))) {

                console.log(evt.eventName, evt.rolesAllowed, socket.data.user.user)

                socket.on(evt.eventName, async (...data) => {
                    // Proteção extra
                    // if (!evt.rolesAllowed.includes(socket.data.user?.role)) return;
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

            // Adiciona socket à "sala do evento" se ele tiver permissão para receber
            if (evt.emitToRoles?.includes(authorities)) {
                socket.join(evt.eventName);
            }
        }




        socket.on('disconnect', () => {
            const entries = Object.entries(roleDisconnectHandlers)

            let handles = entries.filter(([key, value]) => authorities.some((authoritie) => key === authoritie)).map<any>(handle => handle[1])

            handles.forEach(values => {
                values.forEach(fn => fn(socket, socket.data.user.sub))
            })
        })

    });

    return {
        /**
         * Registra evento com controle de roles
         */
        onSecure: ({ eventName, handler, rolesAllowed = ['guest'], emitToRoles = [] }) => {
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
        }
    };
}

export {
    authSocketManager
}
