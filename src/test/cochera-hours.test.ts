import {describe,it,expect} from 'vitest';
import {retainPublishedHour,planCocheraHourRetention} from '../../supabase/functions/_shared/ingestion/cochera-hours.ts';
const incoming={eventId:'e1',start:'2026-12-17T00:00:00Z',buyUrl:'https://lacocheracabaret.com/evento/function-1/',hourUnknown:true};
const known={event_id:'e1',start_datetime:'2026-12-17T20:00:00Z',buy_url:incoming.buyUrl};
describe('Cochera listing preserves a stronger published clock',()=>{
 it('retains a confirmed same-event, same-page clock',()=>expect(retainPublishedHour(incoming,[known])).toBe(true));
 it('retains both published sessions when they share one page and day',()=>expect(retainPublishedHour(incoming,[known,{...known,start_datetime:'2026-12-17T18:00:00Z'}])).toBe(true));
 it('does not treat an unknown-hour row as a published clock',()=>expect(retainPublishedHour(incoming,[{...known,start_datetime:incoming.start}])).toBe(false));
 it('finds the known row even when an old unknown duplicate comes first',()=>expect(retainPublishedHour(incoming,[{...known,start_datetime:incoming.start},known])).toBe(true));
 it('does not reconcile a new explicit clock',()=>expect(retainPublishedHour({...incoming,hourUnknown:false,start:'2026-12-17T19:00:00Z'},[known])).toBe(false));
 it('requires an actual unknown-hour sentinel, not just the flag',()=>expect(retainPublishedHour({...incoming,start:'2026-12-17T19:00:00Z'},[known])).toBe(false));
 it.each([{...known,event_id:'e2'},{...known,buy_url:'https://lacocheracabaret.com/evento/function-2/'},{...known,start_datetime:'2026-12-18T18:00:00Z'},{...known,start_datetime:'invalid'},{...known,buy_url:null}])('keeps distinct or invalid source evidence separate: %j',row=>expect(retainPublishedHour(incoming,[row])).toBe(false));
 it('compares real instants on the Madrid day, including UTC previous day',()=>expect(retainPublishedHour(incoming,[{...known,start_datetime:'2026-12-16T23:30:00Z'}])).toBe(true));
 it('rejects missing URLs and invalid incoming dates',()=>{expect(retainPublishedHour({...incoming,buyUrl:null},[known])).toBe(false);expect(retainPublishedHour({...incoming,start:'invalid'},[known])).toBe(false);});
});

const resolve=(start:string,hourUnknown:boolean)=>({start:new Date(start),end:null,hourUnknown});
describe('Cochera retention persistence plan',()=>{
 it('keeps the two verified Daniel functions and schedules no midnight copies',()=>{
  const first=planCocheraHourRetention('e1',incoming.buyUrl,[resolve(incoming.start,true)],[known]);
  expect(first.get(new Date(incoming.start).toISOString())?.toISOString()).toBe('2026-12-17T20:00:00.000Z');
  const secondURL='https://lacocheracabaret.com/evento/function-2/';
  const second=planCocheraHourRetention('e1',secondURL,[resolve('2026-12-18T00:00:00Z',true)],[{...known,buy_url:secondURL,start_datetime:'2026-12-18T18:00:00Z'}]);
  expect(second.size).toBe(1);expect([...second.values()][0].toISOString()).toBe('2026-12-18T18:00:00.000Z');
 });
 it('does not skip explicit incoming clocks or distinct pages',()=>{
  expect(planCocheraHourRetention('e1',incoming.buyUrl,[resolve('2026-12-17T19:00:00Z',false)],[known]).size).toBe(0);
  expect(planCocheraHourRetention('e1','other-page',[resolve(incoming.start,true)],[known]).size).toBe(0);
 });
 it('chooses the earliest known clock but preserves the input rows and both real sessions',()=>{
  const rows=[known,{...known,start_datetime:'2026-12-17T18:00:00Z'}];const copy=JSON.stringify(rows);
  const plan=planCocheraHourRetention('e1',incoming.buyUrl,[resolve(incoming.start,true)],rows);
  expect([...plan.values()][0].toISOString()).toBe('2026-12-17T18:00:00.000Z');expect(JSON.stringify(rows)).toBe(copy);
 });
});
