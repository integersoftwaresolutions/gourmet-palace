export const money=(cents:unknown,digits=0)=>typeof cents==='number'&&Number.isFinite(cents)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(cents/100):'Unavailable';
export const percent=(value:unknown,digits=1)=>typeof value==='number'&&Number.isFinite(value)?`${value.toFixed(digits)}%`:'Unavailable';
export const ratioPercent=(value:unknown,digits=1)=>typeof value==='number'&&Number.isFinite(value)?`${(value*100).toFixed(digits)}%`:'Unavailable';
export const dateTime=(value:unknown)=>value?new Date(String(value)).toLocaleString():'Unavailable';
export const freshnessTime=(value:unknown,timeZone='America/Los_Angeles')=>{
  if(!value)return 'Unavailable'
  return new Date(String(value)).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone})
}
