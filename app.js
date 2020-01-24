$ = require('jquery'); // koj ce mi ovo qrc
jQuery = $;
//require('./js/selectize.min.js');
//window.pdfMake = window.pdfMake || self.pdfMake; // pdfMake acting wierd on android devices
table4Export=[];
FileSaver = require('file-saver');
var Ractive  = require("ractive");
window.Ractive = Ractive;
//Ractive.DEBUG = false;
Ractive.DEBUG = !!(window.location.hostname == "127.0.0.1" || window.location.hostname == "localhost");
//HOSTNAME = Ractive.DEBUG?'http://test.mobilearea.info/test/':'';
ISMOBILE = (window.innerWidth <= 800);
window.addEventListener('resize', function(event){
    ISMOBILE = (window.innerWidth <= 800);
});

window.rt = require('ractive-touch');
var accounting = require('accounting')
window.accounting = accounting;
var timeago = require("timeago.js");
window.timeago = timeago;
//var Instascan = require('instascan');
//window.Instascan = Instascan;
var izitoast = require('izitoast');
window.izitoast = izitoast;
izitoast.settings({
    progressBar:false
});

//Ractive.events.tap = require( 'ractive-events-tap' );
//var anime = require('animejs');

//import Ractive from 'ractive';

//Ractive.defaults.isolated=true;
Ractive.prototype.unset = function(keypath){
    var lastDot = keypath.lastIndexOf( '.' ),
        parent = keypath.substr( 0, lastDot ),
        property = keypath.substring( lastDot + 1 );

    this.set(keypath);
    delete this.get(parent)[property];
    return this.update(keypath);
}
Ractive.defaults.data.formatNumber = function (n, d=2) { return accounting.formatNumber(n,d,' ') }
Ractive.defaults.data.arraySum = function (arr, fieldName) {  
  //console.log('arraySum',arr, fieldName)
  if (!arr || !arr.length || !fieldName) return 0.0;
  var l =  arr.length;
  var s = 0;
  for (var i=0; i<l; i++) s+=arr[i][fieldName];
  return s;
}
//Ractive.defaults.data.timeago = timeago().format
Ractive.defaults.data.timeago = function(ts) { return ts?timeago().format(ts):'Never'}

//Ractive.defaults.data.moment = moment;
Ractive.components.Root                    =  require('./Root.html');
Ractive.components.dospece                 =  require('./dospece.html');

async function storage2ractive() {
  /*
    var company_id = await db.getItem('company_id');
    ractive.set('company_id', company_id)
    var setings = await db.getItem('setings');
    ractive.set('setings', setings)
    var rows = await db.getItem('rows');
    ractive.set('rows', rows)
    var ts = await db.getItem('ts');
    ractive.set('ts', ts)
    var rola = await db.getItem('rola');
    ractive.set('rola', rola)
    console.log( ractive.get() )
    */
}

document.addEventListener("deviceready", onDeviceReady, false);
if (!window.cordova) onDeviceReady()
async function onDeviceReady() {
    console.log('onDeviceReady')
    var localforage = require('localforage')
    window.localforage = localforage;
    var db = localforage.createInstance()
    await db.ready()
    window.db = db;

    var ractive = new Ractive.components.Root({
        el: 'body',
        append: false
    });
    window.ractive = ractive; 

    function insertAct(tx, CardActivityDailyRecord, prevAct ){
      var activityNight = calcNight(CardActivityDailyRecord.DateTime, prevAct.Time, prevAct.DurationMin);
      var activityDay = prevAct.DurationMin - activityNight;
      tx.executeSql(`INSERT INTO ACTIVITY (
        Distance, 
        DateTime, 
        DailyPresenceCounter, 
        FileOffset, 
        Slot, 
        Status, 
        Inserted, 
        Activity, 
        activityNight,
        activityDay,
        Time, 
        DurationMin, 
        DurationHours
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          CardActivityDailyRecord.Distance,
          CardActivityDailyRecord.DateTime,
          CardActivityDailyRecord.DailyPresenceCounter,
          prevAct.FileOffset,
          prevAct.Slot,
          prevAct.Status,
          prevAct.Inserted,
          prevAct.Activity,
          activityNight,
          activityDay,
          //prevAct.Time,
          time2local(CardActivityDailyRecord.DateTime,prevAct.Time),
          prevAct.DurationMin,
          prevAct.DurationHours
        ],
        function(tx,e){ console.log('save ok')},
        function(tx,e){ console.log('err', e)}
      );      
    }

    function min2hours(m){
      var hours = Math.floor( m / 60 );
      var minutes =  m % 60 ;
      return '' + (hours<10?'0'+hours:hours) + ':' + (minutes<10?'0'+minutes:minutes)
    }

    function timeSub(timeStr1,timeStr2){
      var t1arr = timeStr1.split(':');
      var t2arr = timeStr2.split(':');
      return (t1arr[0]*60 + t1arr[1]*1) - (t2arr[0]*60 + t2arr[1]*1)
    }


    async function executeSqlTrans(tx, sql, params = null){
      return new Promise(function(resolve, reject) {
       // db.transaction(function (tx) {   
          tx.executeSql(
            sql
            , params
            , function(tx, r){ 
                console.log('okkkkkkk', r);
                var arr=[];
                Object.keys(r.rows).forEach(function(key) {
                  arr.push( r.rows[key] );
                }); 
                resolve(arr)
            }
            , function(tx, e){ console.log('err', e); reject(e)}
          );
        //})
      });
    }

    function time2local(datum, time){
      var d = new Date(datum)
      var tzOffset = -1 * d.getTimezoneOffset();
      var timeArr = time.split(':');
      var localTimeInt = 60*parseInt(timeArr[0]) + parseInt(timeArr[1]) + tzOffset;
      var h = (localTimeInt / 60)|0;
      var m = localTimeInt % 60;
      console.log(time, '->', '' + (h<10?'0'+h:h) + ':' + (m<10?'0'+m:m))
      return '' + (h<10?'0'+h:h) + ':' + (m<10?'0'+m:m)
    }

    var ZAVRSETAKNOCNESMENE = 4; // nocni rad je od 00 do 04
    function calcNight(datum, time, duration){
      var d = new Date(datum)
      var tzOffset = -1 * d.getTimezoneOffset();
      var timeArr = time.split(':');
      var localTimeInt = 60*parseInt(timeArr[0]) + parseInt(timeArr[1]) + tzOffset;
      var start = localTimeInt;
      var end = localTimeInt+duration;
      var nightHours=0
      if( end>24*60){
        start = start - 24*60
        end = end - 24*60
      }

      if( start<ZAVRSETAKNOCNESMENE*60 && end>0){
        var s = Math.max(0, start);
        var e = Math.min(end, ZAVRSETAKNOCNESMENE*60);
        nightHours = e - s;
      }

      //var h = (localTimeInt / 60)|0;
      //var m = localTimeInt % 60;
      //console.log(time, '->', '' + (h<10?'0'+h:h) + ':' + (m<10?'0'+m:m))
      //return '' + (h<10?'0'+h:h) + ':' + (m<10?'0'+m:m)
      return nightHours
    }
    
    async function insertActSynh(db, CardActivityDailyRecord, prevAct ){
      var activityNight = calcNight(CardActivityDailyRecord.DateTime, prevAct.Time, prevAct.DurationMin);
      var activityDay = prevAct.DurationMin - activityNight;
      return await executeSqlTrans(
        db
        , `INSERT INTO ACTIVITY (
          Distance, 
          DateTime, 
          DailyPresenceCounter, 
          FileOffset, 
          Slot, 
          Status, 
          Inserted, 
          Activity, 
          activityNight,
          activityDay,
          Time, 
          DurationMin, 
          DurationHours
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
          , 
          [
            CardActivityDailyRecord.Distance,
            CardActivityDailyRecord.DateTime,
            CardActivityDailyRecord.DailyPresenceCounter,
            prevAct.FileOffset,
            prevAct.Slot,
            prevAct.Status,
            prevAct.Inserted,
            prevAct.Activity,
            activityNight,
            activityDay,
            //prevAct.Time,
            time2local(CardActivityDailyRecord.DateTime,prevAct.Time),
            prevAct.DurationMin,
            prevAct.DurationHours
          ]
        )   
    }

    async function getActivity(tx){
      return await executeSqlTrans(
        tx
        , `with PocetakRadnogDana as (
          select DailyPresenceCounter, Time from ACTIVITY
          where FileOffset in (
           select  min(FileOffset) minFileOffset
           from ACTIVITY where activity <> 'Break'
           group by DailyPresenceCounter
          )
        ), KrajRadnogDana as (
          select DailyPresenceCounter, Time from ACTIVITY
          where FileOffset in (
           select  max(FileOffset) maxFileOffset
           from ACTIVITY -- where activity <> 'Break'
           group by DailyPresenceCounter
          )
        )
        , r1 as (
          select 
                  a.Distance, a.DateTime, a.DailyPresenceCounter, a.Activity
                  , case when a.Activity="Break" then sum(a.DurationMin) else 0 end Break 
                  , case when a.Activity="Work" then sum(a.DurationMin) else 0 end Work 
                  , case when a.Activity="Work" then sum(a.activityDay) else 0 end WorkDay 
                  , case when a.Activity="Work" then sum(a.activityNight) else 0 end WorkNight 
                  , case when a.Activity="Driving" then sum(a.DurationMin) else 0 end Driving
                  , case when a.Activity="Driving" then sum(a.activityDay) else 0 end DrivingDay
                  , case when a.Activity="Driving" then sum(a.activityNight) else 0 end DrivingNight
                  , prd.Time PocetakTime
                  , krd.Time KrajTime
                  from ACTIVITY a
                  left join PocetakRadnogDana prd on prd.DailyPresenceCounter = a.DailyPresenceCounter
                  left join KrajRadnogDana krd on krd.DailyPresenceCounter = a.DailyPresenceCounter
                  group by 1, a.Distance, a.DateTime, a.DailyPresenceCounter, a.Activity, prd.Time
                  order by cast(a.DailyPresenceCounter as int)
          ) 
          select Distance, DateTime, DailyPresenceCounter, PocetakTime, KrajTime
          , sum(Break) as Break
          , time(sum(Break)*60, 'unixepoch') as BreakH
          , sum(Work) as Work
          , sum(WorkDay) as WorkDay
          , sum(WorkNight) as WorkNight
          , time(sum(Work)*60, 'unixepoch') as WorkH
          , sum(Driving) as Driving
          , sum(DrivingDay) as DrivingDay
          , sum(DrivingNight) as DrivingNight
          , time(sum(Driving)*60, 'unixepoch') as DrivingH
          from r1
          group by Distance, DateTime, DailyPresenceCounter, PocetakTime, KrajTime
          order by cast(DailyPresenceCounter as int)
          `
        )
    }
      
    function act2weeks(a){
      var week = null
      var l = a.length;
      for (var i=0; i<a.length; i++){
        var currDate = new Date(a[i].DateTime);
        var dow = (currDate.getDay()-1+7) %7; // monday =0 ...
        if (dow===0){ // ponedeljkom pocinjemo novu nedelju
          w = [];
          w.push()

        }
      }
    }


    $.ajax({
      type: "GET",
//      url: "ajax/out.xml",
      url: "ajax/SRB.xml",
      cache:false,
      dataType:"xml",
      success: async function(xml){
        xxml = xml;
        var db = openDatabase('ddd', '1.0', 'tachograph', 5 * 1024 * 1024); 

        db.transaction(async function (tx) {   

          await executeSqlTrans(tx,'DROP TABLE IF EXISTS ACTIVITY');

          await executeSqlTrans(tx,`CREATE TABLE IF NOT EXISTS ACTIVITY (
             id INTEGER PRIMARY KEY AUTOINCREMENT, 
             Distance int, 
             DateTime, 
             DailyPresenceCounter int, 

             FileOffset int, 
             Slot, 
             Status, 
             Inserted, 
             Activity, 
             activityNight,
             activityDay,
             Time, 
             DurationMin, 
             DurationHours
             )`
             ); 
          //tx.executeSql('delete from ACTIVITY');


          //console.log(
          var xDriverCardHolderIdentification = $(xml).find('DriverCardHolderIdentification')[0];
          console.log(xDriverCardHolderIdentification)
          var CardHolderSurname = $(xDriverCardHolderIdentification).find('CardHolderSurname').text();
          var CardHolderFirstNames = $(xDriverCardHolderIdentification).find('CardHolderFirstNames').text();
          var CardHolderBirthDate = $(xDriverCardHolderIdentification).find('CardHolderBirthDate').attr('Datef');
          console.log(CardHolderSurname, CardHolderFirstNames, CardHolderBirthDate)

          $(xxml).find('CardDriverActivity').find('CardActivityDailyRecord').each(function(){
            var CardActivityDailyRecord = {
              Distance: $(this).attr('Distance'), 
              DateTime: $(this).attr('DateTime'),
              DailyPresenceCounter: $(this).attr('DailyPresenceCounter') 
              }
            console.log( "CardActivityDailyRecord",CardActivityDailyRecord )
            var prevAct = null;
            var ActivityChangeInfo = null;
            $(this).find('ActivityChangeInfo').each(function(){
              ActivityChangeInfo = {
                FileOffset: parseInt($(this).attr('FileOffset')), 
                Slot: $(this).attr('Slot'), 
                Status: $(this).attr('Status'), 
                Inserted: $(this).attr('Inserted'), 
                Activity: $(this).attr('Activity'), 
                Time: $(this).attr('Time'), 
                DurationMin:null,
                DurationHours:null
              }
              if (!prevAct) {
                prevAct = Object.assign( {}, ActivityChangeInfo ) 
              }
              else {
                prevAct.DurationMin = timeSub(ActivityChangeInfo.Time, prevAct.Time)
                prevAct.DurationHours = min2hours(prevAct.DurationMin)
                // insert
                insertAct(tx, CardActivityDailyRecord, prevAct)
                console.log( "ActivityChangeInfo", prevAct )
                prevAct = Object.assign( {}, ActivityChangeInfo )
              }
            })
            if (prevAct){
              //insert
              prevAct.DurationMin = timeSub( '24:00', prevAct.Time )
              prevAct.DurationHours = min2hours(prevAct.DurationMin)
              insertAct(tx, CardActivityDailyRecord, prevAct)
              console.log( "ActivityChangeInfo", prevAct )
            }
          })   
          a = await getActivity(tx);
          console.log( a )
          w = act2weeks(a)
          //ractive.set('rows', a.rows);
          D.set('r', a)
        });
        
      }
    })
    //var company_id = await db.getItem('company_id')

    document.addEventListener("backbutton", function(){
      var esc = $.Event("keydown", { keyCode: 27 });
      $("body").trigger(esc);
  
      /*
        if (ractive.get('QRScannerActive')){
            ractive.set('QRScannerActive',false)
            //QRScanner.hide()
            QRScanner.destroy()
            return
        } 
        if (ractive.get('selectedModule')){
            ractive.set('selectedModule',null)
        } else navigator.app.exitApp();
*/
    }, false);

    storage2ractive();
}

// copy iz evolvita
history.pushState(null, "PanLite", "index.html");
window.onpopstate = function(){
	history.pushState(null, "PanLite", "index.html");
	//console.log('pop');
    var esc = $.Event("keydown", { keyCode: 27 });
    $("body").trigger(esc);
    //if (ractive.get('selectedModule')) ractive.set('selectedModule',null)
}

function keydownhandler(e){
    //console.log('keydownhandler');
    if (e.keyCode==27){
        e.stopImmediatePropagation();
        //ractive.set('selectedModule',null)
        //return false;
        if (ractive.get('QRScannerActive')){
          ractive.set('QRScannerActive',false)
          //QRScanner.hide()
          QRScanner.destroy()
          return;
        } 
        if (ractive.get('selectedModule')){
            ractive.set('selectedModule',null)
        } else navigator.app.exitApp();
        
        return false;
    }
}
//console.log(self.nodes.rmodal);
$('body').on( "keydown", keydownhandler );

