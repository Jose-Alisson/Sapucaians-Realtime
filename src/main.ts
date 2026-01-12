
import { io, run, stomp } from "./server.js";
import jwt from 'jsonwebtoken'
import readline from 'readline'

const KEY = process.env['SECURITY_KEY']

run()

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const to = socket.handshake.auth.to; 

  if (!to){
    return next(new Error("To ausente, defina-o para qual estabelecimento você quer se connectar"))
  }

  try {
    const payload = token ? jwt.verify(token, KEY) : null;
    socket.data.user = { authorities: payload?.authorities || ['guest_'+ to], user: payload?.sub ?? 'guest'};
  } catch(ex) {
    console.log(ex)
    socket.data.user = { authorities: ['guest_'+ to] };
  }

  socket.data.to = to
  socket.join(to)

  next();
});


import './manager/deliveryManager.js'
import { registerV2EstablishmentAndOrderManagerStomp } from "./manager/v2/establishmentAndOrderManager.js";

stomp.onConnect = (frame) => {
  registerV2EstablishmentAndOrderManagerStomp()
}