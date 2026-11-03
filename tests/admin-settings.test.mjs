import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toSettingsDraft, settingsPayload, settingsDiff, settingsIssues, taipeiInput } from '../src/utils/adminSettings.ts';
import { EXPORT_FIELDS, exportCsvRow, maskEmail } from '../src/utils/adminExport.ts';

test('settings baseline/diff includes nested announcement, question changes, ordering and clearing times', () => {
  const a=toSettingsDraft({announcement_date:'2026-11-03T04:00:00Z',system_start_time:'2026-11-03T00:00:00Z',custom_questions:[{id:'q1',question:'原題',type:'radio',required:false,options:['甲','乙']}]});
  assert.equal(a.announcement_date,'2026-11-03T12:00');
  assert.deepEqual(settingsDiff(a,structuredClone(a)),[]);
  const b=structuredClone(a);b.system_start_time='';b.announcement_content.title='新公告';b.custom_questions[0].options=['甲','丙'];
  const diff=settingsDiff(a,b);
  assert.ok(diff.some(x=>x.label==='表單開始時間'&&x.after==='未設定'));
  assert.ok(diff.some(x=>x.label==='公告標題'&&x.after==='新公告'));
  assert.ok(diff.some(x=>x.label.includes('題目')&&x.before.includes('乙')&&x.after.includes('丙')));
  const restored=toSettingsDraft({announcement_date:null,system_start_time:null,custom_questions:[]});
  assert.equal(restored.system_start_time,'');
  assert.equal(restored.announcement_date,'');
  assert.equal(toSettingsDraft({system_enabled:null}).system_enabled,false);
  const precise=toSettingsDraft({announcement_date:'2026-11-03T04:00:15.123Z'});
  assert.equal(settingsPayload(precise).announcement_date,'2026-11-03T04:00:15.123Z');
});

test('Taipei settings serialize independently of workstation time zone', () => {
  const a=toSettingsDraft(null);a.system_start_time='2026-11-03T10:30';
  const original=process.env.TZ;
  try {process.env.TZ='America/Los_Angeles';assert.equal(settingsPayload(a).system_start_time,'2026-11-03T02:30:00.000Z');assert.equal(taipeiInput('2026-11-03T02:30:00Z'),'2026-11-03T10:30');}
  finally { if(original===undefined)delete process.env.TZ;else process.env.TZ=original; }
});

test('invalid schedules and question options block publish, late announcement warns', () => {
  const a=toSettingsDraft(null);a.system_start_time='2026-11-03T10:00';a.system_end_time='2026-11-03T09:00';
  assert.ok(settingsIssues(a).errors.some(x=>x.includes('必須早於')));
  a.system_end_time='2026-11-03T12:00';a.subject_score_start_time='2026-11-04T00:00';
  assert.ok(settingsIssues(a).errors.some(x=>x.includes('沒有交集')));
  a.subject_score_start_time='';a.announcement_date='2026-11-05T00:00';
  a.custom_questions=[{id:'q',type:'radio',question:'題目',options:['甲','甲'],startTime:'2026-11-04T00:00'}];
  const issues=settingsIssues(a);
  assert.ok(issues.errors.some(x=>x.includes('重複')));assert.ok(issues.errors.some(x=>x.includes('沒有交集')));
  assert.equal(issues.warnings.length,1);
});

test('selected export columns, masking, zero values and all formula-boundary fields', () => {
  const row={timestamp:'2026-11-03T02:00:00Z',email:'private@example.invalid',minRatio:0,region:'=1+1',custom_answers:{q:'x'}};
  assert.equal(maskEmail(row.email),'***@***');assert.equal(maskEmail(null),'');
  assert.equal(exportCsvRow(row,['email','minRatio'],false,()=>''),'"***@***","0"');
  assert.equal(exportCsvRow(row,['email'],true,()=>''),'"private@example.invalid"');
  assert.equal(exportCsvRow(row,['region','custom_answers'],false,()=>'+SUM(1,2)'), '"\'=1+1","\'+SUM(1,2)"');
  for(const [field] of EXPORT_FIELDS){
    if(field==='timestamp')continue;
    const output=exportCsvRow({[field]:'=1+1'},[field],true,()=> '=1+1');
    assert.equal(output,'"\'=1+1"');
  }
});
