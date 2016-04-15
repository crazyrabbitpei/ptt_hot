var fs = require('fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var moment = require('moment');
var dateFormat = require('dateformat');
var request = require('request');
var striptags = require('striptags');
var deleteTag = require('./deleteTag');
//var nodemailer = require('nodemailer');
//var transporter = nodemailer.createTransport()
var page_link;
var article_link = Array();
/*
   try {
   service = JSON.parse(fs.readFileSync('./data/service'));
   var idbip = service['idbip'];
   var idbport = service['idbport'];
   var md5ip = service['md5ip'];
   var md5port = service['md5port'];
   var idip = service['idip'];
   var idport = service['idport'];
   var apikey = service['apikey'];
   var dbname = service['dbname'];

   }
   catch (err) {
   console.error(err);
   process.exit(9);
   }
   */
function convert(title,body,board,page,date,url){
    var id,md5,title,author,thirdc,fourthc,time,content,reply_name,D,source,U,C,K,preview;
    var record;
    var content_temp;
    var date = dateFormat(date, "yyyymmdd_HHMM");
    }
    exports.convert = convert;

    function findBoardGame(title,body,callback){
        var gamelist = JSON.parse(fs.readFileSync('./control/list'));
        var game = gamelist['game'];
        var type = gamelist['type'];
        var match = gamelist['match'];
        var nomatch = gamelist['not'];
        var game_matchnums=0;
        var namecheck=-1,typecheck=0,nomatchcheck=0;
        var games = game.split(",");
        var matchlist="\tMatch list:none";
        body =  body.toLowerCase();
        title = title.toLowerCase();
        //console.log("title:"+title);
        if((nomatchcheck=title.indexOf(nomatch))!=-1){
            callback(-1,0,-1,matchlist);
        }
        else{
            if(type=="none"){
                for(var i=0;i<games.length;i++){
                    //console.log("["+i+"]games:"+games[i]);
                    if((namecheck=body.indexOf(games[i]))!=-1){
                        matchlist+=","+games[i];
                        game_matchnums++;
                    }
                }
                if(game_matchnums==0){//no match game
                    callback(-1,0,0,matchlist);
                }
                else if(games.length==game_matchnums){//all match
                    callback(2,game_matchnums,0,matchlist);
                    //console.log("["+i+"]games:"+games[i]);
                }
                else if(match<=game_matchnums){//match at least [match] 
                    callback(1,game_matchnums,0,matchlist);
                }
                else if(match>game_matchnums){//match nums less than specify range
                    callback(0,game_matchnums,0,matchlist);
                }
            }
            else{
                if((typecheck=body.indexOf(type))!=-1){
                    for(var i=0;i<games.length;i++){
                        if((namecheck=body.indexOf(games[i]))!=-1){
                            matchlist+=matchlist+","+games[i];
                            game_matchnums++;
                        }
                    }
                    if(game_matchnums==0){//no match game
                        callback(-1,0,1,matchlist);
                    }
                    else if(games.length==game_matchnums){//all match
                        callback(2,game_matchnums,0,matchlist);
                    }
                    else if(match<=game_matchnums){//match at least [match] 
                        callback(1,game_matchnums,0,matchlist);
                    }
                    else if(match>game_matchnums){//match nums less than specify range
                        callback(0,game_matchnums,0,matchlist);
                    }
                }
                else{
                    callback(0,0,-1,matchlist);
                }
            }

        }
    }
