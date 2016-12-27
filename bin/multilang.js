"use strict";

// CMD-TOOL
var multilang={};

var yaml = require('js-yaml');
var fs = require('fs-promise');
var stripBom = require('strip-bom-string');
var Path = require('path');
var changing = require('best-globals').changing;

// locals
// matches: m[1]: LB, m[2]: lang, m[3]: RB
var reLangSec=/([<\[])!--lang:(.*)--([>\]])/;
var reTrimWS = /([\t\r ]*)$/g;
var imgUrl = 'https://raw.githubusercontent.com/codenautas/multilang/master/img/';

multilang.defLang='en';
multilang.stripCommentsFlag = null;

multilang.langs={
    en:{
        name: 'English',
        abr: 'en',
        languages:{
            en: 'English',
            es: 'Spanish',
            it: 'Italian',
            ru: 'Russian',
            de: 'German'
        },
        phrases:{
            language: 'language',
            'also available in': 'also available in',
            'DO NOT MODIFY DIRECTLY': 'DO NOT MODIFY DIRECTLY THIS FILE WAS GENERATED BY multilang.js'
        }
    }
};

// esto se va a inicializar con los yaml de ./langs/lang-*.yaml
multilang.changeDoc=function changeDoc(documentText,lang){
    var obtainedLangs=this.obtainLangs(documentText);
    var langConv = this.parseLang(lang);
    var parts=this.splitDoc(documentText);
    var buttonSection=this.generateButtons(obtainedLangs,lang); // we just need the content
    return parts.map(function(part){
        if('special' in part) {
            switch(part.special){
                case 'header':
                    return (part.withBom?'\ufeff':'')+
                        '<!-- multilang from '+
                        obtainedLangs.langs[obtainedLangs.main].fileName+
                        '\n\n\n\n\n'+
                        langConv.phrases['DO NOT MODIFY DIRECTLY']+
                        '\n\n\n\n\n-->\n';
                case 'buttons':
                     return buttonSection+'\n\n';
            }
        } else {
            if(part.all || part.langs[lang]){
                return part.text;
            }
            return '';
        }
    }).join('');
};

multilang.obtainLangs=function obtainLangs(docHeader){
    var all_langs = {};
    var def_lang = null;
    var langs = /<!--multilang v[0-9]+\s+(.+)(-->)/.exec(docHeader);
    if(langs) {
        var lang_re = /([a-z]{2}):([^.]+\.(md|html))/g;
        var lang;
        while(null !== (lang = lang_re.exec(langs[1]))) {
            if(null === def_lang) { def_lang = lang[1]; }
            all_langs[lang[1]] = {'fileName' : lang[2]};
        }
    }
    return {main:def_lang, langs:all_langs};
};

multilang.generateButtons=function generateButtons(docHeader,lang) {
    if(! this.langs[lang]) { this.langs[lang] = this.parseLang(lang); }
    var ln = changing(this.langs[this.defLang], this.langs[lang]);
    var r=['<!--multilang buttons-->\n\n'];
    r.push(ln.phrases.language+': !['+ln.name+']('+imgUrl+'lang-'+ln.abr+'.png)\n');
    r.push(ln.phrases['also available in']+':');
    var others=[];
    /*jshint forin: false */
    for(var lother in docHeader.langs) {
        if(lother === lang) { continue; }
        var lname = ln.languages[lother];
        others.push('\n[!['+lname+']('+imgUrl+'lang-'+lother+'.png)]('+docHeader.langs[lother].fileName+')');
    }
    /*jshint forin: true */
    r.push(others.join(' -'));
    return r.join('');
};

multilang.splitDoc=function splitDoc(documentText){
    var r = [];
    r.push({special:'header', withBom:'\uFEFF'===documentText.substring(0, 1)});
    var doc = r[0].withBom ? documentText.substring(1) : documentText;
    var docLines = doc.split("\n");
    var inButtons=false;
    var inTextual=false;
    var inLang=false;
    var inAll=false;
    var haveButtonsContent=false;
    for(var ln=0; ln<docLines.length; ++ln) {
        var line=docLines[ln].replace(reTrimWS,''); // right trim ws
        if(line.match("```")) { inTextual = !inTextual; }
        if(!inTextual && !inButtons) {
            var m=line.match(/^(<!--multilang (.*\S+)((\s)*-->)+)/);
            if(m){
                if("buttons"===m[2]) {
                    r.push({special:m[2]});
                    inButtons=true;
                    inAll=false;
                    continue;
                }
                else { continue; }
            } else {
                m = line.match(reLangSec);
                if(m) {
                    inLang = true;
                    inAll=false;
                    if("*" !== m[2]) {
                        var langs = m[2].split(",");
                        var okLangs = {};
                        for(var l=0; l<langs.length; ++l) {
                            okLangs[langs[l]] = true;
                        }
                        r.push({'langs': okLangs});
                    } else {
                        r.push({'all': true});
                    }
                    r[r.length-1].text = '';
                    continue;
                } else if(!inLang && !inAll) {
                    inAll = true;
                    r.push({all:true, text: ''});
                }
            }
        }
        if(inButtons) {
            if("" !== line && !haveButtonsContent) {
                haveButtonsContent=true;
            }
            if(haveButtonsContent && ""===line ) {
                inButtons = false;
            }
        } else {
            r[r.length-1].text += docLines[ln];
            if(ln !== docLines.length-1) { r[r.length-1].text +='\n'; }
        }
    }
    return r;
};

multilang.parseLang=function parseLang(lang){
    var theLang;
    if(this.langs[lang]){
        theLang=this.langs[lang];
    }else {
        var langDir = Path.dirname(Path.resolve(module.filename));
        langDir = langDir.substr(0, langDir.length-4); // erase '/bin'
        var langFile = Path.normalize(langDir+'/langs/lang-'+lang+'.yaml');
        theLang=yaml.safeLoad(stripBom(fs.readFileSync(langFile, 'utf8')));
    }
    return changing(this.langs[this.defLang], theLang);
};

multilang.checkForMissingLangs = function checkForMissingLangs(olangs, prevLang, actualLang, warns, line, isFirstSection) {
    if("*" !== actualLang && !olangs[actualLang]) { return; }
    var prev=null;
    var testing=false;
    var secondLang = false;
    /*jshint forin: false */
    for(var actual in olangs) {
        if(!secondLang && prev) { secondLang = actual; }
        if(!testing && prev===prevLang) { testing = true; }
        if(testing && prev && actual !== actualLang) {
            if((!isFirstSection || actual !== secondLang) && prevLang !== prev) {
                warns.push({line: line, text: 'missing section for lang %', params: [prev]});
            }
        }
        if(actual === actualLang) { break; }
        prev = actual;
    }
    /*jshint forin: true */
    if(actualLang==="*") {
        if(prevLang !== actualLang && prev !== prevLang) {
            warns.push({line: line, text: 'missing section for lang %', params: [prev]});
        }
    }
    else if(!isFirstSection && prevLang === actualLang) {
        warns.push({line: line, text: 'missing section for lang %', params: [prev]});
    }
};

multilang.getWarningsLangDirective=function getWarningsLangDirective(doc){
    var warns=[];
    var obtainedLangs=this.obtainLangs(doc);
    if(!obtainedLangs.main) {
        warns.push({line: 0, text: 'missing section <!--multilang ...->'});
    } else {
        var obtainedLangsKeys = Object.keys(obtainedLangs.langs);
        var docLines = doc.split("\n");
        var prevLang=null, curLang=null;
        var lastLang = obtainedLangsKeys[obtainedLangsKeys.length-1];
        var inCode = false;
        var ln=0;
        var prevClosing=false;
        var lastLangLine=false;
        var isFirstSection=true;
        for(  ; ln<docLines.length; ++ln) {
            var line=docLines[ln].replace(reTrimWS,''); // right trim ws
            if(line.match(/^(```)/)) { inCode = !inCode; }
            if(!inCode) {
                var m=line.match(reLangSec);
                if(m) {
                    curLang = m[2];
                    lastLangLine = ln+1;
                    if(!prevClosing || prevClosing===">" || curLang===obtainedLangs.main) {
                        if((!prevClosing && '<'!== m[1]) || (prevClosing !==']' && '['=== m[1])) {
                            warns.push({line: ln+1, text: 'unbalanced start "'+m[1]+'"' });
                        }
                        if(obtainedLangs.main === curLang && ">" !== m[3]) {
                            warns.push({line: ln+1, text: 'main lang must end with ">" (lang:%)', params: [obtainedLangs.main]});
                        }
                    }
                    else if(prevClosing !== '') {
                        if(prevClosing === "]" && m[1] !== "[") {
                            warns.push({line: ln+1, text: 'unbalanced "["'});
                        } else if(prevClosing===">" && m[1] !== "<") {
                            warns.push({line: ln+1, text: 'unbalanced "<"'});
                        }
                    }
                    if("*" === m[2]) {
                        if(prevLang !== "*" && prevLang !== lastLang) {
                            warns.push({line: ln+1, text: 'lang:* must be after other lang:* or after last lang section (%)',
                                        params: [lastLang] });
                        }
                        if(">" !== m[3]) {
                            warns.push({line: ln+1, text: 'lang:* must end with ">"'});
                        }
                    }
                    else if("*" !== curLang && -1 === obtainedLangsKeys.indexOf(curLang)) {
                        warns.push({line: ln+1, text: '"lang:%" not included in the header', params: [curLang]});
                    }
                    multilang.checkForMissingLangs(obtainedLangs.langs, prevLang, curLang, warns, ln+1, isFirstSection);
                    isFirstSection=false;
                    prevClosing = m[3];
                    prevLang = curLang;
                } else { // in language body
                    // check for lang clause
                    if(line.match(/--lang:(.*)--/)) {
                        warns.push({line: ln+1, text: 'lang clause must not be included in text line'});
                        lastLangLine = ln+1;
                    }
                }
            }
        }
        multilang.checkForMissingLangs(obtainedLangs.langs, prevLang, '*', warns, ln);
        if(prevLang !== "*" && prevLang !== lastLang) {
            warns.push({line: lastLangLine, text: 'last lang must be \"*\" or \"%"\"', params: [lastLang]});
        }
        if(prevLang && prevClosing && prevClosing !== ">") {
            warns.push({line: lastLangLine, text: 'last lang directive could\'n finish in "'+prevClosing+'"'});
        }
    }
    return warns;
};

multilang.getWarningsButtons=function getWarningsButtons(doc){
    var langs = multilang.obtainLangs(doc);
    var langFiles = Object.keys(langs.langs).map(function(lang) { return langs.langs[lang].fileName; });
    var currentLangFile = 0;
    var mainLang = langs.main;
    var docLines = doc.split("\n");
    var btnLines = [];
    var bl = 0;
    var warns=[];
    var inButtonsSection=false;
    var inLang = false;
    var haveMultilangButtons=false;
    for(var ln=0; ln<docLines.length; ++ln) {
        var docLine = docLines[ln].replace(reTrimWS,''); // right trim ws
        if(!inLang) {
            var m = docLine.match(reLangSec);
            if(m) { inLang = m[2]; }
        } else if(inLang && docLine==="") {
            inLang = false;
        }
        if(docLine.match(/^(<!--multilang buttons)/)) {
            haveMultilangButtons=true;
            if(inLang && inLang !== this.defLang) {
               warns.push({line:ln+1, text:'button section must be in main language or in all languages'});
            } else {
                var buttons = this.generateButtons(langs, mainLang);
                btnLines = buttons.split("\n");
                inButtonsSection=true;
                bl = 0;
            }
        }
        if(inButtonsSection) {
            if(btnLines.length>bl) {
                if(btnLines[bl] !== "" && docLine !== btnLines[bl]) {
                    var warningBadLine = {line:ln+1, text:'button section does not match. Expected:\n'+btnLines[bl]+'\n'};
                    if(! docLine.match(/^(\[!\[)/)) {
                        warns.push(warningBadLine);
                    } else {
                        var expectedFileName = langFiles[++currentLangFile];
                        var ref=/\(([^):]+)\)/.exec(docLine);
                        if(ref) {
                            warns.push({line:ln+1, text:"referenced document '"+ref[1]+"' does not exists in multilang header, expected '"+expectedFileName+"'"});
                        } else {
                            warns.push(warningBadLine);
                        }
                    }
                }
                ++bl;
            }
        }
    }
    if(!haveMultilangButtons) {
        warns.push({line:0, text:'missing section <!--multilang buttons-->'});
    }
    return warns;
};

multilang.getWarnings=function getWarnings(doc){
    return this.getWarningsButtons(doc).concat(this.getWarningsLangDirective(doc));
};

multilang.stringizeWarnings=function stringizeWarnings(warns) {
    var r=[];
    for(var w=0; w<warns.length; ++w) {
        var text = warns[w].text;
        if(warns[w].params) { text = text.replace('%', warns[w].params); }
        r.push('line ' + warns[w].line + ': ' + text + '\n');
    }
    return r.join('');
};

multilang.stripComments = function stripComments(doc) {
    var docLines = doc.split('\n');
    var o=[];
    // All In One Line
    var reAIOL=/(<!--(\s*((--[^>])|([^-]+[^>]))+\s*)+-->)/g;
    var reS = /<!--/;
    var reE = /-->/;
    var reT = /```/;
    var inComment = false;
    var inTicks = false;
    for(var ln=0; ln<docLines.length; ++ln) {
        var line = docLines[ln].replace(reTrimWS,''); // right trim ws
        var start = reS.exec(line);
        var end = reE.exec(line);
        inTicks = inTicks ? !reT.exec(line) : reT.exec(line);
        if(! inTicks) {
            if(start && end) {
                var m=reAIOL.exec(line);
                o.push(line.substring(0, m.index));
                var first=null;
                var lastLen=null;
                while(m) {
                    if(! first) {
                        first = m.index;
                    } else {
                        o.push(line.substr(lastLen, m.index-lastLen));
                    }
                    lastLen=reAIOL.lastIndex;
                    m=reAIOL.exec(line);
                }
                var el = line.substr(lastLen, line.length-1);
                o.push(el);
                if(first === 0 && el==="") { continue; }
            } else if(start) {
                if(! inComment) {
                    o.push(line.substring(0, start.index));
                    inComment=true;
                    if(start.index === 0) {
                        continue;
                    } else {
                        o.push('\n');
                    }
                }
            } else if(end) {
                var el2=line.substring(end.index+end[0].length);
                o.push(el2);
                inComment = false;
                if(el2==="") { continue; }
            } else {
                if(! inComment) {
                    o.push(line);
                } else {
                    continue;
                }
            }
        } else {
            o.push(line);
        }
        if(ln+1<docLines.length && !inComment) {
            o.push('\n');
        }
    }
    return o.join('');
};

multilang.changeNamedDoc=function changeNamedDoc(documentName, documentText, lang){
    var content = multilang.changeDoc(documentText, lang);
    var strip = multilang.stripCommentsFlag === true;
    if(documentName === 'README.md' && multilang.stripCommentsFlag !== false) {
        strip = true;
    }
    if(strip) { content = multilang.stripComments(content); }
    return content;
};

multilang.main=function main(parameters){
    multilang.stripCommentsFlag = parameters.stripComments;
    var chanout = parameters.silent ? { write: function write(){} } : parameters.chanout || process.stdout;
    if(parameters.verbose) {
        chanout.write("Processing '"+parameters.input+"'...\n");
    }
    return fs.readFile(parameters.input,{encoding: 'utf8'}).then(function(readContent){
        var obtainedLangs=multilang.obtainLangs(readContent);
        var langs=parameters.langs || Object.keys(obtainedLangs.langs); // warning the main lang is in the list
        langs=langs.filter(function(lang){ return lang !== obtainedLangs.main; });
        if(langs.length>1 && parameters.output){
            throw new Error('parameter output with more than one lang');
        }
        if(langs.length<1){
            throw new Error('no lang specified (or main lang specified)');
        }
        if(!parameters.directory) {
            throw new Error('no output directory specified');
        }
        if(!parameters.silent){
            (parameters.chanerr || process.stderr).write(multilang.stringizeWarnings(multilang.getWarnings(readContent)));
        }
        // verificar que la salida no contenga a la entrada
        var outFiles = [];
        if(parameters.output) {
            outFiles.push({file:Path.normalize(parameters.directory + "/" + parameters.output),lang:langs[0]});
        } else {
            langs.map(function(lang) {
                outFiles.push({file:Path.normalize(parameters.directory + "/" + obtainedLangs.langs[lang].fileName), lang:lang});
            });
        }
        var inputDir = Path.dirname(parameters.input);
        var inputFile = Path.resolve((inputDir !== '' ? inputDir : process.cwd())+"/"+Path.basename(parameters.input));
        for(var f=0; f<outFiles.length; ++f) {
            if(Path.resolve(outFiles[f].file) === inputFile) {
                throw new Error('input and output should be different');
            }
        }
        if(! parameters.check) {
            if(!parameters.langs && parameters.verbose) { chanout.write("Generating all languages...\n"); }
            return Promise.all(outFiles.map(function(oFile){
                if(parameters.verbose) {
                    chanout.write("Generating '"+oFile.lang+"', writing to '"+oFile.file+"'...\n");
                }
                var changedContent=multilang.changeNamedDoc(Path.basename(oFile.file), readContent, oFile.lang);
                return fs.writeFile(oFile.file, changedContent).then(function(){
                    if(parameters.verbose) {
                        chanout.write("Generated '"+oFile.lang+"', file '"+oFile.file+"'.\n");
                    }
                });
            }));
        }
    }).then(function(){
        return Promise.resolve(0);
    });
};

module.exports = multilang;
