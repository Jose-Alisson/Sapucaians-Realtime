import UUID from 'crypto'
import { DateTime } from 'luxon'

let tasks: { id: string , timeOut: NodeJS.Timeout }[] = []

const MINUTE = 1000 * 60
const HOUR = MINUTE * 60
const DAY_TO_MILISECONDS = HOUR * 24

function registerTask(action: () => any, timeTo: string, id?: string) {

    let time = getTimeTo(timeTo)
    let actionStart = setTimeout(action, time)
    tasks.push({id: id ? id : UUID.randomUUID(), timeOut:  actionStart})

    //console.log(`Registrado ${id} para daqui a ${getHoursStringByTime(time)}`)

    return {
        cancell(){
            clearTimeout(actionStart)
        }
    }
}

function cancelTasks(ids: string[]){
    ids.forEach(id => {
        cancelTask(id)
    })
}

function cancelTask(id: string) {
    let index = tasks.findIndex(tasks => tasks.id === id)

    if(index != -1){
        let task = tasks[index]
        clearTimeout(task.timeOut)
        tasks.splice(index, 1)
    }
}

function getTimeTo(to: string) {
    let time = DateTime.now().setZone('America/Sao_Paulo');
    let currentyTime = getTimeHoursString(`${time.hour}:${time.minute}`)
    let timeTo = getTimeHoursString(`${to}`)
    return Math.max(0, timeTo - currentyTime)
}

function getTimeHoursString(time: string) {
    const [hours, minutes] = time.split(':').map(t => parseInt(t))
    return HOUR * hours + MINUTE * minutes
}

function getHoursStringByTime(time){
     // Converte ms para minutos
  let totalMinutes = Math.floor(time / 60000);

  // Separa horas e minutos
  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;

  // Formata com zero à esquerda
  let hh = String(hours).padStart(2, "0");
  let mm = String(minutes).padStart(2, "0");

  return `${hh}:${mm}`;
}

export {
    getTimeTo,
    registerTask, 
    cancelTasks,
    getHoursStringByTime,
    DAY_TO_MILISECONDS
}