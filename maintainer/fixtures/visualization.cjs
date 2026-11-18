'use strict';

const metadata={
 schemaVersion:1,
 title:'Validate a saved measurement',
 number:'LOCAL-VISUAL-1',
 application:'both',
 repositories:[
  {key:'legacy',area:'Custom (Legacy CRM/XRM)',use:'reference',path:'Legacy'},
  {key:'cdms',area:'CDMS',use:'implement',path:'CDMS'},
  {key:'dab',area:'DAB (GraphQL)',use:'implement',path:'DAB'},
  {key:'ui',area:'Shared Angular UI',use:'implement',path:'UI'}
 ]
};
const state={
 schemaVersion:2,
 pbi:'LOCAL-VISUAL-1',
 status:'Awaiting PO/BA Decision',
 paths:{cdms:{applies:true},dab:{applies:true},ui:{applies:true}},
 actors:[{id:'ACT-1',role:'Operator',permissions:'Create a measurement'}],
 decisions:[{id:'DEC-1',status:'approved',decision:'Reject invalid values'}],
 rules:[{
  id:'BR-1',rule:'An invalid measurement is rejected with a clear message',
  context:'Measurement creation',
  evidence:['EV-LEGACY','EV-CDMS'],
  paths:{
   legacy:{status:'reaches',evidence:['EV-LEGACY']},
   cdms:{status:'reaches',evidence:['EV-CDMS']},
   dab:{status:'not-verified',evidence:[]},
   ui:{status:'reaches',evidence:['EV-UI']}
  },
  targetAction:'extend',
  branches:[
   {id:'BR-1.N',condition:'The value is invalid',expected:'Reject the save and show a clear message',cdms:'covered',dab:'partial',ui:'covered',evidence:['EV-CDMS','EV-UI'],acceptance:['AC-1']}
  ]
 }],
 acceptanceCriteria:[{
  id:'AC-1',rev:1,type:'negative',rules:['BR-1'],
  criterion:'Given an invalid measurement, when it is saved, then the save is rejected with a clear message'
 }],
 evidence:[
  {id:'EV-LEGACY',repository:'legacy',kind:'repo-file',level:'code',source:'Legacy/Plugins/MeasurementCreatePlugin.cs',location:'Execute'},
  {id:'EV-CDMS',repository:'cdms',kind:'repo-file',level:'code',source:'CDMS/Handlers/CreateMeasurementHandler.cs',location:'Handle'},
  {id:'EV-UI',repository:'ui',kind:'repo-file',level:'reach',source:'UI/src/app/measurement/measurement.component.ts',location:'save'}
 ],
 dependencies:[{id:'DEP-1',description:'DAB behavior corresponding to BR-1',evidence:[],status:'unverified'}]
};

module.exports={metadata,state};
