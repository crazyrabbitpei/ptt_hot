var bodyParser = require('body-parser');
var urlencode = require('urlencode');
var LineByLineReader = require('line-by-line');
var iconv = require('iconv-lite');
var querystring = require("querystring");
var fs = require('graceful-fs');
var S = require('string');

var request = require('request');
var CronJob = require('cron').CronJob;

var express = require('express');
var app  = express();
var http = require('http');
var server = http.createServer(app);

var HashMap = require('hashmap');
var map_key  = new HashMap();//to store local(hot) id
var normal_map_key  = new HashMap();//to store others location id
var map_botkey  = new HashMap();//to store others location id
var popular  = new HashMap();//for insertSeed API:search hot address

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));
//--read setting--url manager
var service = JSON.parse(fs.readFileSync('./service/hot_board0212/url_manager'));
var apiip = service['id_serverip'];
var apiport = service['id_serverport'];
var writeidInterval = service['writeidInterval'];
var filename = service['hot_id_filename'];
var normal_id_filename = service['normal_id_filename'];
var url_mapSize = service['size'];
var tw_address_filename = service['tw_address'];
var map_size=0;//update with url map(cronjob), using clearID function
var normal_map_size=0;//update with url map(cronjob), using clearID function
var all_crawled=0;
//var apiip = "localhost";


var from_seed_idIndex=0;
var from_data_idIndex=0;
var normal_from_seed_idIndex=0;
var normal_from_data_idIndex=0;
//--read data--
//ReadTWaddress();
ReadHotID();
ReadNormalID();
ReadBotID();

var job = new CronJob({
    cronTime:writeidInterval,
    onTick:function(){
        clearID();
    },
    start:false,
    timeZone:'Asia/Taipei'
});
job.start();
//new CronJob(writeidInterval,clearID, null, true, 'Asia/Taipei');
//--server process--
process.on('SIGINT', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    job.stop();
    process.exit(0);

});
process.on('SIGTERM', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    job.stop();
    process.exit(0);
});
server.listen(apiport,apiip,function(){
    console.log("[Server start] ["+new Date()+"] http work at "+apiip+":"+apiport);
});
//----------------


//----------------

/*---------for url manage--------------
 * for data bot
 * boards_type can ignore
 - search an id , return time ex:Fri Apr 15 15:35:49 2016
 - update a id:update/boards_type/?ids=id~time
 -boards_type default is hot
 -ids ex:movie~Fri Apr 15 15:35:49 2016
 -notice: this API CAN't BE used to delete or insert seed
 --------------------------------------*/
app.get('/pttjob/:key/v1.0/databot/:action(search|update)/:boards_type?',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    var action = req.params.action;
    var boards_type = req.params.boards_type;
    if(typeof boards_type==="undefined"){
        boards_type = "hot";
    }
    var ids = req.query.ids;//for update/search action
    console.log("--\naction:"+action);
    if(typeof ids ==="undefined"){
        res.send("must contains id");
        return;
    }
    if(action=="update") {
        datamanageid(boards_type,action,ids,function(stat){
            res.send(stat);
        });       
    }
    else if(action=="search"){//single id
        data_bot_searchid(boards_type,ids,function(stat){
            res.send(stat);
        });
    }
});
/*------insert new seed--------*/
/*
 * for seed bot and data bot
     ?ids=movie:hot~girl:normal...
     a set of id
     default id normal
     */
/*------insert new seed--------*/
app.get('/pttjob/:key/v1.0/insertseed/',function(req,res){
    var i,j;
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    var seeds = req.query.ids;
    console.log("=>insert:"+seeds);

    var result="";
    var parts = seeds.split("~");
    var loca_parts="";
    var id="";
    for(i=0;i<parts.length;i++){
        console.log(i+":"+parts[i]);
        if(parts[i]==""){
            continue;
        }
        loca_parts = parts[i].split(":");
        if(loca_parts.length==1){
            id = loca_parts[0];
            loca = "normal";
        }
        else if(loca_parts.length==2){
            id = loca_parts[0];
            loca = loca_parts[1];
        }
        else{
            continue;
        }
        if(id==""||loca==""){
            continue;
        }
        //TODO:use address API
        if(loca=="hot"){
            if(map_size>=url_mapSize){
                console.log("map_size>=url_mapSize:"+map_size);
                res.send("full");
                return;
            }
            if(!map_key.has(id)){
                console.log("insert seed to hot:"+id);
                if(normal_map_key.has(id)){
                    var timestamp = normal_map_key.get(id);
                    if(typeof timestamp!=="undefined"){
                        map_key.set(id,timestamp);
                    }
                    else{
                        map_key.set(id,"y");
                        popular.set(id,0);
                    }
                    normal_map_key.remove(id);
                }
                else{
                    map_key.set(id,"y");
                    popular.set(id,0);
                }

                if(i!=0){
                    result+=","+id;
                }
                else{
                    result=id;
                }
            }
            if(normal_map_key.has(id)){
                normal_map_key.remove(id);
            }
        }
        else{
            if(normal_map_size>=url_mapSize){
                console.log("normal_map_size>=url_mapSize:"+normal_map_size);
                res.send("full");
                return;
            }
            if(!normal_map_key.has(id)){
                if(map_key.has(id)){
                    var timestamp = map_key.get(id);
                    if(typeof timestamp!=="undefined"){
                        normal_map_key.set(id,timestamp);
                    }
                    else{
                        normal_map_key.set(id,"y");
                        popular.set(id,0);
                    }
                    map_key.remove(id);
                }
                else{
                    normal_map_key.set(id,"y");
                    popular.set(id,0);
                }
                if(i!=0){
                    result+=","+id;
                }
                else{
                    result=id;
                }
                console.log("insert seed to normal:"+id);
            }
            if(map_key.has(id)){
                map_key.remove(id);
            }

        }
    }
    if(parts.length==0){
        loca_parts = parts[0].split(":");
        id = loca_parts[0];
        loca = loca_parts[1];
        //TODO:use address API
        
        if(loca=="hot"){
            if(!map_key.has(id)){
                if(normal_map_key.has(id)){
                    var timestamp = normal_map_key.get(id);
                    if(typeof timestamp!=="undefined"){
                        map_key.set(id,timestamp);
                    }
                    else{
                        map_key.set(id,"y");
                        popular.set(id,0);
                    }
                    normal_map_key.remove(id);
                }
                else{
                    map_key.set(id,"y");
                    popular.set(id,0);
                }
                result=id;
                console.log("insert seed to hot:"+id);
            }
        }
        else{
            if(!normal_map_key.has(id)){
                if(map_key.has(id)){
                    var timestamp = map_key.get(id);
                    if(typeof timestamp!=="undefined"){
                        normal_map_key.set(id,timestamp);
                    }
                    else{
                        normal_map_key.set(id,"y");
                        popular.set(id,0);
                    }
                    map_key.remove(id);
                }
                else{
                    normal_map_key.set(id,"y");
                    popular.set(id,0);
                }
                result=id;
                console.log("insert seed to normal:"+id);
            }
        }
    }
    res.send(result);
});

/*------delete seed--------*/
/*
 * for seed bot and data bot
     ?ids=movie~girl...
     a set of id
     */
/*------delete seed--------*/
app.get('/pttjob/:key/v1.0/deleteseed/',function(req,res){
    var i,j;
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    var seeds = req.query.ids;
    var result="";
    var parts = seeds.split("~");
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){
            continue;
        }
        if(map_key.has(parts[i])){
            map_key.remove(parts[i]);
            if(result!=""){
                result+=","+parts[i];
            }
            else{
                result = parts[i];
            }
        }
        if(normal_map_key.has(parts[i])){
            normal_map_key.remove(parts[i]);
            if(result!=""){
                result+=","+parts[i];
            }
            else{
                result = parts[i];
            }
        }

    }
    res.send(result);
});
/*------get a set of seed to crawler--------*/
/*
 require [num] to cralwer<=/?q=num, default=1
*/
/*------get a set of seed to crawler--------*/
app.get('/pttjob/:key/v1.0/getseed/:boards_type?',function(req,res){
    var key = req.params.key;
    var boards_type = req.params.boards_type;

    if(typeof boards_type==="undefined"){
        boards_type = "hot";
    }
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var num = req.query.num;
    var from_index = req.query.from;
    console.log("1.num:"+num+"\n2.from index:"+from_index);
    var priorty = req.query.priorty;//not yet ,for data/seed priorty. Hasn't crawled first.
    if(typeof num==="undefined"){
        num=1;
    }
    var values="";
    num = parseInt(num);
    if(boards_type=="hot"){
        total_num = map_key.count();
        values = map_key.values();
    }
    else{
        total_num = normal_map_key.count();
        values = normal_map_key.values();
    }

    var result="";
    var index=0;
    var end_index=0;

    var nc_count=0,c_count=0;
    var jump_flag=0;
    var i,temp_index=-1;
    //for(i=0;i<values.length;i++){
        /*not yet*/
        /*
        if(values[i]=="y"&&temp_index==-1){
            if(boards_type=="hot"){
                from_seed_idIndex=i;
            }
            else{
                normal_from_seed_idIndex=i;
            }
            temp_index++;
        }
        */
        /*not yet*/
        /*
        if(type=="databot"){
            if(boards_type=="hot"){
                if(i==from_data_idIndex&&(values[i]!="c"||values[i]!="y")){
                    jump_flag=1;
                }
            }
            else{
                if(i==normal_from_data_idIndex&&(values[i]!="c"||values[i]!="y")){
                    jump_flag=1;
                }
            }
        }
        else if(type=="seedbot"){
            if(boards_type=="hot"){
                if(i==from_seed_idIndex&&values[i]=="c"){
                    jump_flag=1;
                }
            }
            else{
                if(i==normal_from_seed_idIndex&&values[i]=="c"){
                    jump_flag=1;
                }
            }

        }
        */
       /*
        if(type=="databot"){
            if(values[i]=="y"||values[i]=="c"){
                if(jump_flag==1){
                    if(boards_type=="hot"){
                        rom_data_idIndex = i;
                    }
                    else{
                        normal_from_data_idIndex = i;
                    }
                    jump_flag=0;
                }
                nc_count++;
            }
            else{
                c_count++;
            }
        }
        if(type=="seedbot"){
            if(values[i]!="c"){
                if(jump_flag==1){
                    if(boards_type=="hot"){
                        from_seed_idIndex = i;
                    }
                    else{
                        normal_from_seed_idIndex = i;
                    }
                    jump_flag=0;
                }
                nc_count++;
            }
            else{
                c_count++;
            }
        }
        */
    //}
    /*
    if(nc_count!=0){
        if(boards_type=="hot"){
            from_seed_idIndex = 0;
        }
        else{
            normal_from_seed_idIndex = 0;
        }
    }
    */
    if(nc_count==0){
        all_crawled=1;
    }
    else if(nc_count!=0){
        all_crawled=0;
    }

    //else if(type=="databot"){
        if(boards_type=="hot"){
            if((from_data_idIndex+num)>total_num){
                from_data_idIndex=0;
            }
        }
        else{
            if((normal_from_data_idIndex+num)>total_num){
                normal_from_data_idIndex=0;
            }

        }
        if(num>total_num){
            num = total_num;
        }
        console.log("--["+boards_type+"]--\nrequest data seed num:"+num);
        if(boards_type=="hot"){
            if(typeof from_index!=="undefined"&&from_index!=-1){
                from_data_idIndex=from_index;
                all_crawled=1;
            }
            console.log("from local index:"+from_data_idIndex);
            end_index = from_data_idIndex+num;
            if(end_index>=total_num){
                end_index = total_num;

            }
            console.log("to local index:"+end_index);
        }
        else{
            if(typeof from_index!=="undefined"&&from_index!=-1){
                normal_from_data_idIndex=from_index;
                all_crawled=1;
            }
            console.log("from normal index:"+normal_from_data_idIndex);
            end_index = normal_from_data_idIndex+num;
            if(end_index>=total_num){
                end_index = total_num;
            }
            console.log("to normal index:"+end_index);

        }
    //}

    console.log("["+boards_type+"] map_key.count:"+total_num);
    if(total_num==0||num==0){
        res.send("none");
        return;
    }
    //check list status:how many url hasn't crawled

    var j=0;
    if(boards_type=="hot"){
        map_key.forEach(function(value, key) {
            if(num==0){
                return;
            }
            //else if(type=="databot"){
                if(all_crawled==0){
                    if(index>=from_data_idIndex&&(value=="y"||value=="c")){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
                            if(j!=0){
                                result+=","+key;
                            }
                            else{
                                result+=key;
                            }
                            j++;
                        }
                    }
                }
                if(all_crawled==1){
                    if(index>=from_data_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
                            if(j!=0){
                                result+=","+key;
                            }
                            else{
                                result+=key;
                            }
                            j++;
                        }
                    }
                }
            //}
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(index>=from_data_idIndex){
                    from_data_idIndex = index;
                    console.log("next index:"+from_data_idIndex);
                }
                res.send(result);
                return;
            }
            else if(j!=0&&j<num&&index==total_num){
                console.log("["+index+"]get url num != request num:"+j);
                all_crawled=1;
                res.send(result);
                return;
            }
            else if(index==total_num){
                res.send(result);
                return;
            }
        });

    }
    else{
        normal_map_key.forEach(function(value, key) {
            if(num==0){
                return;
            }
            //else if(type=="databot"){
                if(all_crawled==0){
                    if(index>=normal_from_data_idIndex&&(value=="y"||value=="c")){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
                            if(j!=0){
                                result+=","+key;
                            }
                            else{
                                result+=key;
                            }
                            j++;
                        }
                    }
                }
                if(all_crawled==1){
                    if(index>=normal_from_data_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
                            if(j!=0){
                                result+=","+key;
                            }
                            else{
                                result+=key;
                            }
                            j++;
                        }
                    }
                }
            //}
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(index>=normal_from_data_idIndex){
                    normal_from_data_idIndex = index;
                    console.log("next index:"+normal_from_data_idIndex);
                }
                res.send(result);
                return;
            }
            else if(j!=0&&j<num&&index==total_num){
                console.log("["+index+"]get url num != request num:"+j);
                all_crawled=1;
                res.send(result);
                return;
            }
            else if(index==total_num){
                res.send("(#1)"+result);
                return;
            }
        });

    }
});

/*-------listing and searching url list-----------*/
/*
 * for both seed and data bot
 - search:will use ids to show it detail=>return movie~Fri Apr 15 15:35:49 2016~1515~hot  [boar name]~[time]~[popular]~[hot/normal]
    -no need for boards_type
 */
/*-------listing and searching url list-----------*/
app.get('/pttjob/:key/v1.0/urllist/databot/:action(search)/:boards_type?',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    var action = req.params.action;
    var boards_type = req.params.boards_type;
    var ids = req.query.ids;
    var i;

    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    if(typeof boards_type==="undefined"||boards_type==""){
        boards_type = "hot";
    }
    var nc_count=0,c_count=0;
    if(action=="search"){
        if(typeof ids==="undefined"){
            res.send("must contains id");
            return;
        }
        searchid(boards_type,ids,function(stat){
            res.send(stat);
        });
    }
    /*
    else if(action=="list"){
        var values="";
        if(boards_type=="hot"){
            values = map_key.values();
        }
        else{
            values = normal_map_key.values();
        }
        for(i=0;i<values.length;i++){
            if(type=="seedbot"){
                if(values[i]!="c"){
                    nc_count++;
                }
                else{
                    c_count++;
                }
            }
            if(type=="databot"){
                if(values[i]!="y"&&values[i]!="c"){
                    c_count++;
                }
                else{
                    nc_count++;
                }
            }
        }
        res.send("["+boards_type+"]["+type+"] total:"+values.length+" crawled:"+c_count+" not crawled:"+nc_count);
    }
    */
    else{
        res.send("unavailable action")
    }
});


/*-------listing and searching hot's address list-----------*/
/*
 * for both seed and data bot
 - search:search?address=location_name ex:address=Taipei  or address=臺北
 - list:list all address I have in hot
 */
/*-------listing and searching url list-----------*/
app.get('/pttjob/:key/v1.0/tw_address/:action(list|search)/',function(req,res){
    var key = req.params.key;
    var action = req.params.action;
    var i,j,k;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    if(action=="list"){
        var result="";
        map_tw_address.forEach(function(value, key) {
            if(result==""&&key!=""){
                result=key+","+value;
            }
            else if(key!=""){
                result+="\n"+key+","+value;
            }
        });
        res.send(result);
    }
    else if(action=="search"){
        var address = req.query.address;
        var small_address1 = S(address).left(3).s;
        var small_address2 = S(address).left(2).s;
        var raddress="";
        if((raddress = map_tw_address.get(address))||(raddress = map_tw_address.get(small_address1))||(raddress = map_tw_address.get(small_address2))){
        //if((raddress = map_tw_address.get(address))||(raddress = (address=="hot"))||(raddress = (address=="台灣"))||(raddress = (address=="臺灣"))||(raddress = map_tw_address.get(small_address1))||(raddress = map_tw_address.get(small_address2))){
            res.send(raddress);
        }
        else{
            res.send("none");
        }
    }
});
app.get('/pttjob/:key/v1.0/updatepopular/',function(req,res){
    var key = req.params.key;
    var id = req.query.ids;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var parts = id.split('~');
    var board = parts[0];
    var p = parts[1];
    if(typeof p ==="undefined"){
        res.send("Must contain popularity");
    }
    else{
        var flag=0;
        if(!map_key.get(board)){
            if(normal_map_key.get(board)){
                popular.set(board,p);
                flag=1;
            }
        }
        else{
            popular.set(board,p);
            flag=1;
        }
        if(flag==0){
            res.send("none");
        }
        else{
            res.send(board);
        }
    }

});
/*force store id_manage*/

app.get('/pttjob/:key/v1.0/update/:config(list|tw_address)/',function(req,res){
    var key = req.params.key;
    var config = req.params.config;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    if(config=="list"){
       clearID();
       res.send("id_manage has updated");

    }
    /*
    else if(config=="tw_address"){
        ReadTWaddress();
        res.send("tw_address has updated");
    }
    */
    else{
        res.send("Unavailable config")
    }
});
function updateseedid(boards_type,str,id,fin){
    //console.log("process:"+id+","+str+"\n--");
    var result="";
    if(boards_type=="hot"){
        if(!map_key.has(id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
            //console.log("not exists:"+id+","+str+"\n--");
            result = "not exists:"+id+","+str+"\n--";
        }
        else{
            if(map_key.get(id)=="y"||map_key.get(id)=="c"){//if is cralwed by data bot, couldn't update it because has timestamp
                if(str=="-1"){
                    //map_key.remove(id);
                    //console.log("delete:"+id+","+str+"\n--");
                    result = "Please use deleteseed API to delete id\n--";
                }
                else{
                    result="update:"+id+","+str+"\n--";
                    map_key.set(id,str);
                }
            }
            else{
                if(str=="-1"){
                    //result = "can't delete ["+id+"] from ["+boards_type+"]:must using data bot api to do this because some issue(this id was crawled by data bot and has timestamp)";
                    result = "Please use deleteseed API to delete id\n--";

                }
            }
        }
    }

    else{
        if(!normal_map_key.has(id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
            //console.log("not exists:"+id+","+str+"\n--");
            result = "not exists:"+id+","+str+"\n--";
        }
        else{
            if(normal_map_key.get(id)=="y"||normal_map_key.get(id)=="c"){//if is cralwed by data bot, couldn't update it because has timestamp
                if(str=="-1"){
                    //normal_map_key.remove(id);
                    //console.log("delete:"+id+","+str+"\n--");
                    result = "Please use deleteseed API to delete id\n--";
                }
                else{
                    result="update:"+id+","+str+"\n--";
                    normal_map_key.set(id,str);
                }
            }
            else{
                if(str=="-1"){
                    //result = "can't delete ["+id+"] from ["+boards_type+"]:must using data bot api to do this because some issue(this id was crawled by data bot and has timestamp)\n--";
                    result = "Please use deleteseed API to delete id\n--";
                }
            }
        }
    }
    fin(result);
    return;

}
function datamanageid(boards_type,action,ids,fin){
    var i,j,k;
    var stat="";
    console.log(ids);
    if(action=="update"){
        console.log("update process:"+ids+"\n--");
        var ids_set = ids.split(",");
        var parts,parts_id,parts_status;
        for(i=0;i<ids_set.length;i++){
            console.log("ids_set:"+ids_set[i]);
            if(ids_set[i]==""){
                continue;
            }
            parts = ids_set[i].split("~");
            if(parts.length!=2){
                continue;
            }
            parts_id = parts[0];
            parts_status = parts[1];
            if(parts_id==""||parts_status==""){
                continue;
            }
            if(map_key.has(parts_id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
                if(parts_status=="-1"){
                    stat += "can't delete id ["+parts_id+"], please use deleteseed API to delete id\n--";
                    continue;
                }
                else{
                    console.log("update:"+parts_id+","+parts_status+"\n--");
                    stat+="\nupdate id["+parts_id+"] ";
                }
                if(parts_status!="-1"){
                    map_key.set(parts_id,parts_status);

                }
            }
            else if(normal_map_key.has(parts_id)){
                if(parts_status=="-1"){
                    stat += "can't delete id ["+parts_id+"], please use deleteseed API to delete id\n--";
                    continue;
                }
                else{
                    console.log("update:"+parts_id+","+parts_status+"\n--");
                    stat+="\nupdate id["+parts_id+"]";
                }
                if(parts_status!="-1"){
                    normal_map_key.set(parts_id,parts_status);
                }
            }
            else{
                stat+="\nnot exist:id["+parts_id+"]";
                continue;
            }
        }
        fin(stat);
        return;
    }
}
function data_bot_searchid(boards_type,id,fin){
    var result="none";
    result=map_key.get(id);
    if(typeof result==="undefined"){
        result=normal_map_key.get(id);
        if(typeof result==="undefined"){
            result="none"
        }
    }
    fin(result);
}
function searchid(boards_type,ids,fin){
    var datas = ids.split(",");
    var result="none";
    var i,j;
    for(i=0;i<datas.length;i++){
        if(datas[i]==""){
            continue;
        }
        var flag=0;
        if(typeof map_key.get(datas[i])==="undefined"){
            if(typeof normal_map_key.get(datas[i])!=="undefined"){
                if(i!=0){
                    result+="\n"+datas[i]+"~"+normal_map_key.get(datas[i])+"~"+popular.get(datas[i])+"~normal";
                }
                else{
                    result=datas[i]+"~"+normal_map_key.get(datas[i])+"~"+popular.get(datas[i])+"~normal";
                }
            }
            else{
                result="none";
            }
        }
        else{
            if(i!=0){
                result+="\n"+datas[i]+"~"+map_key.get(datas[i])+"~"+popular.get(datas[i])+"~hot";

            }
            else{
                result=datas[i]+"~"+map_key.get(datas[i])+"~"+popular.get(datas[i])+"~hot";
            }
        }
    }
    fin(result);
}

function ReadHotID(){
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
        job.stop();
        process.exit(0);
    });
    lr.on('line', function (line) {
        var part = line.split("\t");
        var board_name;
        if(part.length==3){
            board_name = part[1];
            popular.set(board_name,part[0]);
            map_key.set(board_name,part[2]);
        }
        else if(part.length==2){
            board_name = S(part[1]).between('bbs/','/index').s;
            popular.set(board_name,part[0]);
            map_key.set(board_name,'y');
        }
        else{
            board_name = S(part[0]).between('bbs/','/index').s;
            popular.set(board_name,0);
            map_key.set(board_name,'y');
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        console.log("read ptt hot url list done");
    });

}
function ReadNormalID(){
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(normal_id_filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
        job.stop();
        process.exit(0);
    });
    lr.on('line', function (line) {
        var part = line.split("\t");
        var board_name;
        if(part.length==3){
            board_name = part[1];
            popular.set(board_name,part[0]);
            normal_map_key.set(board_name,part[2]);
        }
        else if(part.length==2){
            board_name = S(part[1]).between('bbs/','/index').s;
            popular.set(board_name,part[0]);
            normal_map_key.set(board_name,'y');
        }
        else{
            board_name = S(part[0]).between('bbs/','/index').s;
            popular.set(board_name,0);
            normal_map_key.set(board_name,'y');
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        //job.start();
        console.log("read normal id done");
    });

}
function ReadBotID(){
    var key="",name="";
    var i;
    map_botkey.clear();
    for(i=0;i<service["data"].length;i++){
        key = service["data"][i]["key"];
        name = service["data"][i]["name"];
        console.log("bot:"+key+" name:"+name);
        map_botkey.set(key,name);
    }
}
function clearID(){
    var result="";
    var normal_result="";
    map_key.forEach(function(value, key) {
        if(value!=""&&key!=""&&value!=-1&&typeof value !=="undefined" &&typeof key!=="undefined"&&key!="undefined"&&value!="undefined") {

            var p = popular.get(key);
            //console.log(key + " : " + value+":"+p);
            result+=p+"\t"+key+"\t"+value+"\n";
        }
        else{
            map_key.remove(key);
            //console.log("clear:"+key + " : " + value);
        }
    });
    fs.writeFile(filename,result,function(err){
        if(err) throw err;
        console.log("write to:"+filename);
    });
    map_size = map_key.count();

    normal_map_key.forEach(function(value, key) {
        if(value!=-1&&typeof value !=="undefined"&&typeof key!=="undefined"&&key!="undefined"&&value!="undefined") {
            //console.log(key + " : " + value);
            var p = popular.get(key);
            //console.log(key + " : " + value+":"+p);
            normal_result+=p+"\t"+key+"\t"+value+"\n";
        }
        else{
            normal_map_key.remove(key);
            //console.log("clear:"+key + " : " + value);
        }
    });
    fs.writeFile(normal_id_filename,normal_result,function(err){
        if(err) throw err;
        console.log("write to:"+normal_id_filename);
    });
    normal_map_size = normal_map_key.count();
}

