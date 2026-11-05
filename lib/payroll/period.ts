export function payrollMonthRange(value:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<1900)throw new Error('فترة الرواتب غير صالحة');
 const [year,month]=value.split('-').map(Number);return {start:value+'-01',end:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)};
}
export function currentPayrollMonth(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).formatToParts(new Date());return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;}
