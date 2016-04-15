var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var moment = require('moment');
var dateFormat = require('dateformat');
var request = require('request');
var striptags = require('striptags');
var deletetag = require('./deleteTag');

var old_date="";
var p_board="";
function convert(lastpost,lastdate,title,body,board,url,owner,linc,linc_length,current_page,end_page,fin){
    var date = dateFormat(new Date(), "yyyymmdd");
    var record="";
    if(date!=old_date&&p_board!=board){
        old_date = date;
        p_board = board;
        record = "@gaisR\n";
    }
    title = title.replace(/\n/g,"");
    title = title.replace(/\s/g,"");

    record += "@\n@title:"+title+"\n";
    record += "@source:ptt/"+board+"\n";
    record += "@url:"+url+"\n";
    toGais(lastpost,lastdate,record,body,date,owner,board,linc,linc_length,current_page,end_page,function(reach){
            fin(reach,owner,board,current_page,linc,linc_length,url);
    });
}
function toGais(lastpost,lastdate,record,content,date,owner,board,linc,linc_length,current_page,end_page,fin){
    var timeS=0;
    var bodyS=0;

    deletetag.delhtml(content,function(result){
        var resulttemp="";
        var time="";
        //time = S(result).between("時間","\n");
        var find_time = result.match(/\b(?:(?:Mon)|(?:Tues?)|(?:Wed(?:nes)?)|(?:Thur?s?)|(?:Fri)|(?:Sat(?:ur)?)|(?:Sun))(?:day)?\b[:\-,]?\s*[a-zA-Z]{3,9}\s+\d{1,2}\s*(\d{2}):(\d{2}):(\d{2}),?\s*\d{4}/);
        if(find_time!=null){
            time = find_time[0];
            time = he.decode(time);
        }
        /*if the web format is not regular(doesn't contain title,author,time...),but has "時間" in body, will fetch wrong 
        time.Sometimes, fetched comment's message
            ex:推 luuluu: 宋出來就是休息時間 都在懷才不遇倒垃圾以為觀眾是心理醫 12/26 16:14
        will fetch "12/26 16:14", but after formating by Date, it'll convert to 2001 year, writing following to avoid 
        this situation.
        */
        if(time.indexOf("/")!=-1){
            time="";
        }
        /*------------------------*/
        if(time==""||time=="\t\t"||time==null){
            time = S(result).between("發信站","轉信站");//https://www.ptt.cc/bbs/movie/M.1073844095.A.html
            time = he.decode(time);
            if(time==""||time=="\t\t"){
                timeS=1;
            }
        }
        
        var starts = time;
        if(timeS==1){
            starts = "分享";//https://www.ptt.cc/bbs/BoardGame/M.1200247379.A.EAC.html
        }
        resulttemp = S(result).between(starts,"※ 發信站: 批踢踢實業坊(ptt.cc)");

        if(resulttemp==""){
            resulttemp = S(result).between(starts,"※ 編輯:");//https://www.ptt.cc/bbs/movie/M.1113111801.A.7B8.html
            if(resulttemp==""){
                resulttemp = S(result).between(starts,"※ Origin:");//https://www.ptt.cc/bbs/movie/M.1085743924.A.html
                if(resulttemp==""){
                    resulttemp = S(result).between(starts,"http://www.kkcity.com.tw/freeisp/");
                    if(resulttemp==""){
                        resulttemp = S(result).between(starts,"bbs.e-cia.net");
                        if(resulttemp==""){
                            bodyS=1;
                        }
                    }
                }
            }
        }

        if(bodyS==0&&timeS==1){//no title,time, matching body end
            time = 0;
            //time = he.decode(time);
        }
        else if(bodyS==1&&timeS==1){//no title,time,and no matching body end
            time = 0;
            resulttemp = result;
            //time = he.decode(time);
        }
        else if(bodyS==1&&timeS==0){//no matching body end, has time
            resulttemp = result;
        }
        //record last timestamp
        
        //console.log("==>linc:"+linc+" linc_length:"+linc_length+" current_page:"+current_page+" end_page:"+end_page);
        if(linc==lastpost&&(current_page==end_page||current_page=="")){
            //console.log("write!!");
            if(time!=0){
                fs.writeFile('./ptt_data/'+owner+'/'+board+'/lastdate.txt',time);
            }
            else{
                var time2 = new Date();
                time = time2;
                fs.writeFile('./ptt_data/'+owner+'/'+board+'/lastdate.txt',time2);
            }
        }
        var s_lastdate=0,s_time=0;
        if(lastdate!=0){
            lastdate = new Date(lastdate);
            s_lastdate = lastdate.toString();
            s_lastdate = s_lastdate.split(" ");
            s_lastdate = parseInt(s_lastdate[3]);
        }

        if(time!=0){
            temp_time = new Date(time);
            s_time = temp_time.toString();
            s_time = s_time.split(" ");
            s_time = parseInt(s_time[3]);
        }
        else{
            temp_time = 0;
        }

        var interval = s_lastdate - s_time;
        if(time!=0&&temp_time<=lastdate&&lastdate!=0&&interval==0){//special case https://www.ptt.cc/bbs/Gossiping/M.1447840600.A.074.html
            console.log(temp_time+" is reach to or smaller then lastdate:"+lastdate);
            result = he.decode(resulttemp);
            record +="@time:"+temp_time+"\n";
            record += "@body:"+result+"\n";

            fs.appendFile("./ptt_data/"+owner+"/"+board+"/"+date+"_stop",record,function(){
            });
            fin(1);
        }
        else{
            //console.log(time+" is bigger then lastdate:"+lastdate);
            result = he.decode(resulttemp);
            record +="@time:"+temp_time+"\n";
            record += "@body:"+result+"\n";

            fs.appendFile("./ptt_data/"+owner+"/"+board+"/"+date,record,function(){
            });
            fin(0);
        }
    });

}
function convert1(title,body,board,url){
    var id,md5,title,author,thirdc,fourthc,time,content,reply_name,D,source,U,C,K,preview;
    var record;
    var content_temp;
    var date = dateFormat(date, "yyyymmdd_HHMM");
    getid(function(result){
        id = '@\n@id:'+result+'\n';
        //fs.appendFile('./ptt_data/'+board+'/'+date+'_ptt.rec', iconv.encode(id,'utf-8'),function (err) {});

        D = '@D:ptt\n';
        source = '@S:ptt\n';
        U = '@U:'+url+'\n';
        C = '@C:'+board+'\n';
        K = '@K:\n';

        id = he.decode(id);
        D = he.decode(D);
        source = he.decode(source);
        U = he.decode(U);
        C = he.decode(C);
        K = he.decode(K);

        var $ = cheerio.load(body);
        left = $("body > div > div.bbs-screen.bbs-content > article-metaline-right");
        left = S(left).s;
        title = $("body > div > div.bbs-screen.bbs-content > div:nth-child(3).article-metaline > span:nth-child(2).article-meta-value");
        author = $("body > div > div.bbs-screen.bbs-content > div:nth-child(1).article-metaline > span:nth-child(2).article-meta-value");

        //may be a four row:發信人,標題,發信站,轉信站
        thirdc = $("body > div > div.bbs-screen.bbs-content > div:nth-child(4).article-metaline > span:nth-child(1).article-meta-tag");
        thirdc = S(thirdc).between('<span class="article-meta-tag">','</span>').s;
        thirdc = he.decode(thirdc);
        if(thirdc=='發信站'){//get 轉信站 row
            fourthc = $("body > div > div.bbs-screen.bbs-content > div:nth-child(5).article-metaline > span:nth-child(2).article-meta-value");
            fourthc = S(fourthc).between('<span class="article-meta-value">','</span>').s;
        }
        else{
            fourthc='0';
        }

        time = $("body > div > div.bbs-screen.bbs-content > div:nth-child(4).article-metaline > span:nth-child(2).article-meta-value");
        content = $("body > div > div.bbs-screen.bbs-content");
        content_temp = content;			
        reply_content = $("body > div > div > div.push");

        reply = reply_content;

        //format to idb

        title = '@T:'+S(title).between('<span class="article-meta-value">','</span>').s+'\n';
        author = '@author:'+S(author).between('<span class="article-meta-value">','</span>').s+'\n';
        if(fourthc==0){
            temp = S(time).between('<span class="article-meta-value">','</span>').s;
        }
        else{
            temp = S(time).between('<span class="article-meta-value">','</span>').s;
            temp = S(temp).between('(',')').s;
        }
        temp = he.decode(temp);
        temp1 = temp;
        temp1 = moment(temp1,'ddd MMM DD h:mm:ss YYYY').format('YYYYMMDD hh:mm:ss');
        if(thirdc=='發信站'){

            time = '@t:'+temp1+'\n';
            fourthc = he.decode(fourthc);
            temp1 = fourthc;
            fourthc = '@from_place:'+fourthc+'\n';
        }
        else{
            time = '@t:'+temp1+'\n';
        }
        content_temp = S(content_temp).between('<span class="article-meta-value">'+temp+'</span></div>\n','--').s;
        content_temp = S(content_temp).replaceAll('\n',' ').s;
        content_temp = S(striptags(content_temp)).s;
        getmd5(content_temp,function(result){
            md5 = '@md:'+result+'\n';
            //fs.appendFile('./ptt_data/'+board+'/'+date+'_ptt.rec', iconv.encode(md5,'utf-8'),function (err) {});
            //TODO:preview's word if is chinese will not cut clear,so currently put nothing
            //preview = '@P:'+S(content_temp).left(300).s+'\n';
            preview = '@P:\n';
            content = '@B:'+S(content).between('<span class="article-meta-value">'+temp+'</span></div>\n','--').s+"\n";



            //reply = '@reply:'+reply+'\n';


            title = he.decode(title);
            author = he.decode(author);
            time = he.decode(time);
            content = he.decode(content);
            preview = he.decode(preview);
            //reply = he.decode(reply);
            //content = S(content).replaceAll('\n','<br>').s+'\n';

            record = iconv.encode(id,'utf-8')+iconv.encode(md5,'utf-8')+iconv.encode(D,'utf-8')+iconv.encode(source,'utf-8')+iconv.encode(U,'utf-8')+iconv.encode(C,'utf-8')+iconv.encode(K,'utf-8')+iconv.encode(time,'utf-8')+iconv.encode(title,'utf-8')+iconv.encode(preview,'utf-8')+iconv.encode(content,'utf-8');
            putToDB(record);
            /*fs.appendFile('./ptt_data/'+board+'/'+date+'_ptt.rec',iconv.encode(id,'utf-8')+iconv.encode(md5,'utf-8')+iconv.encode(D,'utf-8')+iconv.encode(source,'utf-8')+iconv.encode(U,'utf-8')+iconv.encode(C,'utf-8')+iconv.encode(K,'utf-8')+iconv.encode(time,'utf-8')+iconv.encode(title,'utf-8')+iconv.encode(preview,'utf-8')+iconv.encode(content,'utf-8'), function (err) {
              });*/

        });
    });
}
exports.convert = convert;
function getid(fin){
    request({
        method: 'GET',
        uri:"http://"+idip+":"+idport+"/id/get/number/",
        timeout:10000
    },function(error,res,body){
        //console.log(body);
        fin(body);
    });
}
function getmd5(par,fin){
    request({
        method: 'POST',
        uri:"http://"+md5ip+":"+md5port+"/api/query/getmd5",
        timeout:10000,
        body:par
    },function(error,res,body){
        //console.log(body);
        fin(body);
    });
}
function putToDB(record){
    request({
        method: 'POST',
        uri:"http://"+idbip+":"+idbport+"/api/query/import/"+dbname+"/"+apikey,
        timeout:10000,
        body:record
    },function(error,res,body){
        //console.log(body+"uri:"+"http://"+idbip+":"+idbport+"/api/query/import/"+dbname+"/"+apikey);
    });

}
