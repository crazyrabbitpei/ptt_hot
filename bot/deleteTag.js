var request = require('request');
//var md5 = require('MD5');
var S = require('string');
var fs = require('fs');
var cheerio = require('cheerio');
//var regexp = require('node-regexp');
/*
   try {
   fs.readFileSync('compare.rec');
   }
   catch (err) {
   console.error(err);
   }
   */
function start(filename,fin){
    fs.readFile(filename,"utf-8",function(error,data){
        if(error){
            fin(error);
        }
        else{
            delhtml(data,fin);
        }
    });
}
function delhtml(content,fin){
    try{
        //test = content.match(/(<title(.*?)>(.|[\r\n])*?<\/title>)/g);
        //fin(test);
        //content = "hello";
        test = content.match(/(<body(.*?)>(.|[\r\n])*?<\/body>)/g);
        content = "";
        if(test!=null){
            //$ = cheerio.load(content);
            //content = $.html('body');

            for(i=0;i<test.length;i++){
                content += test[i];
            }

            //test = content.match(/(<script(.*?)>(.|[\r\n])*?<\/script>)|(<style(.*?)>(.|[\r\n])*?<\/style>)|[\r\n]/g);
            test = content.match(/(<script(.*?)>(.|[\r\n])*?<\/script>)|(<style(.*?)>(.|[\r\n])*?<\/style>)/g);
            if(test!=null){
                for(i=0;i<test.length;i++){
                    //console.log("test["+i+"]:"+test[i]);
                    //content = S(content).strip(test[i]).s;
                    content = S(content).replace(test[i]," ").s;
                }
            }
            content = S(content).stripTags().s;
            fin(content);
        }
        else{
            test = content.match(/(<script(.*?)>(.|[\r\n])*?<\/script>)|(<style(.*?)>(.|[\r\n])*?<\/style>)/g);
            if(test!=null){
                for(i=0;i<test.length;i++){
                    content = S(content).strip(test[i]).s;
                }
            }
            content = S(content).stripTags().s;
            fin(content);
        }
        //console.log("result:"+content);

    }
    catch(e){
        console.log(e);
    }

}
exports.start = start;
exports.delhtml = delhtml;

