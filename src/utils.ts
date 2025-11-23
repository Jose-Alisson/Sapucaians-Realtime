import { authSocketManager } from "./manager/socketManager.js";
import { io } from "./server.js";

function timeToDate(number){
  return new Date(number)
}

function formatarData(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();

  return `${ano}-${mes}-${dia}`;
}

export {
    formatarData,
    timeToDate
}