import {test} from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../workflows/helpers.mjs';
const {readAttendanceFilters,attendanceWhere,attendanceExceptions,attendanceTiming,deviceMetadata}=await load('lib/attendance/console.ts');
const filters=query=>readAttendanceFilters(new URLSearchParams(query));
test('rejects impossible dates, reversed periods and unknown statuses',()=>{
  for(const query of [{from:'2026-02-30'},{from:'2026-11-04',to:'2026-11-01'},{status:'invented'}]) assert.throws(()=>filters(query));
});
test('pagination sanitizes invalid values and bounds page size',()=>{
  assert.equal(filters({page:'NaN',pageSize:'9000'}).page,1);assert.equal(filters({page:'NaN',pageSize:'9000'}).pageSize,100);assert.equal(filters({page:'-1'}).page,1);
});
test('search and filters are always ANDed with employee visibility',()=>{
  const where=attendanceWhere(filters({search:'FAZAL REHMAN',branch:'branch1',from:'2026-11-01',to:'2026-11-02',mode:'biometrics',device:'ZK'}),{employeeId:'scoped'});
  assert.equal(where.AND[0].employeeId,'scoped');assert.equal(where.AND[1].workDate.lt.toISOString(),'2026-11-03T00:00:00.000Z');assert.ok(where.AND.some(item=>item.notes?.contains==='"source"'));assert.ok(where.AND.some(item=>item.employee?.branchId==='branch1'));
});
test('notes parser never exposes raw biometric payload, IP or identity values',()=>{
  const value=deviceMetadata(JSON.stringify({source:'ZKTECO_MAIN_BRANCH',deviceName:'Main',deviceIp:'10.0.0.1',nationalId:'private',raw:{secret:true}}));
  assert.deepEqual(Object.keys(value).sort(),['deviceName','receivedAt','source']);assert.equal(deviceMetadata('broken'),null);assert.equal(deviceMetadata('null'),null);assert.equal(deviceMetadata('{}'),null);
});
test('unassigned employees have no invented lateness and incomplete hours stay unknown',()=>{
  const timing=attendanceTiming({workDate:new Date('2026-11-01'),checkIn:new Date('2026-11-01T10:00:00+03:00'),checkOut:null});assert.equal(timing.lateMinutes,null);assert.equal(timing.workedHours,null);
});
test('assigned shifts calculate Riyadh lateness and actual overnight duration',()=>{
  const row={workDate:new Date('2026-11-01'),checkIn:new Date('2026-11-01T22:15:00+03:00'),checkOut:new Date('2026-11-02T06:15:00+03:00')};const timing=attendanceTiming(row,{name:'Night',startTime:'22:00',endTime:'06:00'});assert.equal(timing.lateMinutes,15);assert.equal(timing.workedHours,8);
});
test('reversed timestamps are flagged rather than reported as zero worked hours',()=>{
  const timing=attendanceTiming({workDate:new Date('2026-11-01'),checkIn:new Date('2026-11-01T10:00:00Z'),checkOut:new Date('2026-11-01T09:00:00Z')});assert.equal(timing.invalidTimes,true);assert.equal(timing.workedHours,null);
});
test('missing punches only become review exceptions for past days, excluding holidays',()=>{
  const value=attendanceExceptions('2026-11-02');assert.equal(value.OR[1].workDate.lt.toISOString(),'2026-11-02T00:00:00.000Z');assert.ok(value.OR[1].status.notIn.includes('HOLIDAY'));
});
