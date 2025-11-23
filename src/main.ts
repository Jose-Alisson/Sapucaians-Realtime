
import { io, run, stomp } from "./server.js";
import jwt from 'jsonwebtoken'
import readline from 'readline'

const KEY = process.env['SECURITY_KEY']

run()

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = token ? jwt.verify(token, KEY) : null;
    socket.data.user = { authorities: payload?.authorities ?? ['guest'], user: payload?.sub ?? 'guest'};

    //console.log(payload)
    // console.log(payload, socket.data.user)
    //console.log(payload?.roles?.find((role: string) => role.includes("ROLE_")))
    next();
  } catch(ex) {
    console.log(ex)
    socket.data.user = { authorities: ['guest'] };
    next();
  }
});

import './manager/orderManager.js';
import './manager/establishmentManager.js'
import './manager/printerManager.js'
import './manager/deliveryManager.js'
import { registerOrderStomp } from "./manager/orderManager.js";
import { registerDeliveryStomp } from "./manager/deliveryManager.js";

stomp.onConnect = (frame) => {
  registerOrderStomp()
  registerDeliveryStomp()
}