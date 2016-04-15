var web_pttserver = require('./web_pttserver.js');
var CronJob = require('cron').CronJob;
var fs = require('graceful-fs');
var HashMap = require('hashmap');
var Promise = require('promise');

var board_info = new HashMap();

var dir;
var page_interval;
var article_interval;
var againTime;
var nextBoardt;
var startnum=0;
var job=0;

var r_cnt=[],r_name=[],r_bname=[],r_index=[],r_item=[],r_lastdate=[];

//run_bot("peipei",startnum,function(cnt,name,bname,index,item,lastdate){
run_bot("peipei",startnum,function(result){
	var i,j,k;
	var parts = result.split(",");
	var info;

	for(i=0;i<parts.length-1;i++){
		info = parts[i].split("~");	
		if(info[0]==""|info[1]==""||info[2]==""||info[3]==""||info[4]==""||info[5]==""){
			console.log("[error] NO."+cnt+" =>name:"+name+" bname:"+bname);
			continue;
		}
		r_cnt.push(info[0]);
		r_name.push(info[1]);
		r_bname.push(info[2]);
		r_index.push(info[3]);
		r_item.push(info[4]);
		r_lastdate.push(info[5]);


	}
	for(i=0;i<r_cnt.length;i++){
		console.log("NO."+r_cnt[i]+" =>name:"+r_name[i]+" bname:"+r_bname[i]);
	}
	
        setBot(0,r_name[0],r_bname[0],r_index[0],r_item[0],r_lastdate[0]);
    //else{
        //console.log("NO."+cnt+" =>name:"+name+" bname:"+bname);
        //console.log("length:"+boards.length+"=>"+boards[boards.length-1]);
        //setBot(cnt,name,bname,index,item,lastdate);
    //}
});


function setBot(cnt,name,bname,index,item,lastdate){
        web_pttserver.crawlIndex(cnt,name,bname,index,item,lastdate,function(board,count,t_name,t_index,t_item,t_lastdate){
		console.log("=>name:"+board+" done");
		if(board==503||board=="503"){
			console.log("["+board+"]"+count+","+t_name+","+bname+","+t_index+","+t_item+","+t_lastdate);
		}
		else{
			console.log("next:"+r_bname[count+1]);
			if((count+1)<r_cnt.length){
				setTimeout(function(){
					setBot(count+1,r_name[count+1],r_bname[count+1],r_index[count+1],r_item[count+1],r_lastdate[count+1]);
				},(10000*(count+1))+nextBoardt);
			}
		}
		
        });
}

function run_bot(owner,snum,fin){
    //read service information
    try{
        var boards;
        service = JSON.parse(fs.readFileSync('./service/'+owner+'/service'));
        boards = service['boards'];
        dir = service['data_dir'];
        page_interval = service['intervalPer_page'];
        article_interval = service['intervalPer_article'];
        againTime = parseInt(service['againTime']);
        nextBoardt = parseInt(service['nextBoardt']);
       
        exports.dir = dir;
        exports.page_interval = page_interval;
        exports.article_interval = article_interval;
        exports.againTime = againTime ;
        exports.nextBoardt = nextBoardt;
        exports.startnum = startnum ;
	
	var boards_list = [];
	var result = "";
        //create folder or use existing
        for(var i=0;i<boards.length;i++){
            //boards_list.push(boards[i].name);
            createDir(i,owner,boards[i].name,function(cnt,name,bname,index,item,lastdate){
                //console.log(name+"/["+cnt+"]"+bname+" dir created done"+" index:"+index+" item:"+item);
		result +=cnt+"~"+name+"~"+bname+"~"+index+"~"+item+"~"+lastdate+",";
                //fin(cnt,name,bname,index,item,lastdate);
		if(cnt==boards.length-1){
			fin(result);	
		}
            });
        }
    }
    catch(e){
        console.log("[error] run_bot:"+e);
        fin(0,0,0,0,0,0);
    }
}
function createDir(cnt,owner,board,fin){
    var index,item,lastdate;
    var status=0;
    try{
        fs.exists(dir+"/"+owner+"/"+board,function(exists){
            if(exists) {
                console.log(dir+"/"+owner+"/"+board+" is exists");
                //index = fs.readFileSync(dir+'/'+owner+'/'+board+'/index.txt','utf8');
                //console.log("index:"+index);

                fs.readFile(dir+'/'+owner+'/'+board+'/index.txt',function read(err,data){
                    if(err){
                        throw err;
                    }
                    else{
                        index = parseInt(data);
                        //console.log("index:"+index);
                        fs.readFile(dir+'/'+owner+'/'+board+'/item.txt',function read(err,data){
                            if(err){
                                throw err;
                            }
                            else{
                                item = parseInt(data);
                                fs.readFile(dir+'/'+owner+'/'+board+'/lastdate.txt',function read(err,data){
                                    if(err){
                                        throw err;
                                    }
                                    else{
                                        lastdate = data;
                                        fin(cnt,owner,board,index,item,lastdate);
                                    }
                                });
                                
                            }
                        });
                    }
                });

                //item = fs.readFileSync(dir+'/'+owner+'/'+board+'/item.txt','utf8');
                //console.log("item:"+item);

            }
            else{
                index=0;
                item=0;
                lastdate=0;
                console.log("no "+ dir+"/"+owner+"/"+board);
                fs.mkdir(dir,function(){
                    console.log("create:"+dir);
                    fs.mkdir(dir+"/"+owner,function(){
                        console.log("create:"+dir+"/"+owner);
                        fs.mkdir(dir+"/"+owner+"/"+board,function(){
                            console.log("create:"+dir+"/"+owner+"/"+board);
                            fs.writeFile(dir+'/'+owner+"/"+board+'/index.txt','0');
                            fs.writeFile(dir+'/'+owner+"/"+board+'/item.txt','0');
                            fs.writeFile(dir+'/'+owner+"/"+board+'/lastdate.txt','0');
                            fin(cnt,owner,board,index,item,lastdate);
                        });	
                    });	
                });
            }
        });
    }
    catch(e){
        console.log("[error] createDir:"+e);
        status=1;
        fin(0,0,0,0,0,0);

    }
    /*
       finally{
       if(status==0){
       console.log("->index:"+index);
       console.log("->item:"+item);
       fin(owner,board,index,item);
       }
       else{
       fin(0,0,0,0);
       }
       } 
       */

}


