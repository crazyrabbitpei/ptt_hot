var fs = require('graceful-fs');
var LineByLineReader = require('line-by-line');
var line_c=0;
var file_index=1;
var last=0;

var list_name=`${__dirname}/getBoardname/list/t_boardsname`;
cutListFile(list_name);

function cutListFile(filename){
    var options = {
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(filename,options);
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
    });
    lr.on('line', function (line) {
        line_c++;
        if(line_c==50){
            file_index++;
            line_c=0;
        }
        if(line_c!=1){
            fs.appendFile(`${__dirname}/getBoardname/split_list/`+file_index+`_split`,"\n"+line,function(err){
                if(err) throw err;
            });
        }
        else{
            fs.appendFile(`${__dirname}/getBoardname/split_list/`+file_index+`_split`,line,function(err){
                if(err) throw err;
            });
        }
    });
    lr.on('end',function(){
        console.log("read and cut ptt url list done");
    });
}


