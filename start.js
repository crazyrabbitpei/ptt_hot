'use strict'

var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var dateFormat = require('dateformat');
var pttBot = require('./client_bot.js');
var now = new Date();

var service = JSON.parse(fs.readFileSync('./service/hot_board0212/url_manager'));
var apiip = service['id_serverip'];
var apiport = service['id_serverport'];
var board_type = service['board_type'];
var dataDir = service['owner'];
var key = service["data"][0]["key"]

var success_url=0;
var current_url=0;
var Bot_runStatus=1;

setpromise();

function setpromise(){
    var start_d  = new Date();
    var date_start = dateFormat(start_d, "yyyymmdd_HHMM");
    let promise = new Promise(function(resolve,reject){
        start(function(result){
            resolve(result);
        });
    });

    promise.then(function(stat){
        if(stat.indexOf('endTONext@Gais:')!=-1){
            success_url++;
            console.log("success num:"+success_url);
            let now  = new Date();
            let date = dateFormat(now, "yyyymmdd");
            let parts = stat.split("endTONext@Gais:");
            let crawled_id = parts[1];
            let records_num = parts[2];
            let end_d  = new Date();
            let date_end = dateFormat(end_d, "yyyymmdd_HHMM");
            if(crawled_id!="crawled"){
                fs.appendFile('./logs/'+date+'.oklist',"total nums:"+records_num+"\nstart:"+date_start+"\nend:"+date_end+"\n"+crawled_id+"\n--\n",function(){
                });
            }
            if(success_url<2){
                setpromise();     
            }
        }
        else if(stat=='none'){
            console.log('nothing to be crawled.');
            setpromise();          
        }
        else if(stat.indexOf('error')!=-1){
            console.log("error occur:"+stat);
            process.exit();
        }
        else{
            console.log("else:"+stat);
            process.exit();
        }
    }).catch(function(error){
        let now  = new Date();
        let date = dateFormat(now, "yyyymmdd");
        fs.appendFile('./logs/'+date+'.err','error:'+error+'\n',function(){
            console.log("promise error occur:"+error);
        });
    });
    
}

function start(fin){
    var request_num=1;
    requireSeed(request_num,-1,function(result){
        //console.log(result);
        if(result=="none"){
            fs.appendFile("./logs/err_log","init=>requireSeed:has map is empty\n",function(){});
            console.log("init=>requireSeed:has map is empty");
            fin(result);
            return;
        }
        else if(result=="error"){
            console.log("requireSeed:error");
            fin(result);
            return;
        }
        var fail=0;
        var seeds = result.split(",");
        var i;
        for(i=0;i<seeds.length;i++){
            setBot(key,seeds[i],function(bot_result){
                fin(bot_result);
            });
        }
    });

}

function requireSeed(num,from_index,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/?q='+num);
    request({
        uri:'http://'+apiip+':'+apiport+'/pttjob/'+key+'/v1.0/getseed/'+board_type+'?num='+num+'&from='+from_index,
        timeout: 10000
    },function(error, response, body){
        //console.log("get seed:["+body+"]");
        if(error){
            fs.appendFile("./logs/err_log","requireSeed:"+error+"\n",function(){});
            fin("error");
            return;
        }
        fin(body);
    });
}

function setBot(botkey,groupid,fin){
    console.log("--\ngo groupid:"+groupid);
    pttBot.run(dataDir,botkey,groupid,function(){

    });
    /*
    try{
        fbBot.crawlerFB(limit,retryFields,token,groupid,botkey,function(result){
            current_url++;
            console.log("current num:"+current_url);
            if(result=="error"){
                console.log(result);
                fin(result);
            }
            else{
                fin(result);
            }
        });
    }
    catch(e){
        console.log(e);
    }
    */
}
