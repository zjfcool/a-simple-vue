class Vue {
    constructor(options){
        this.vm = this;
        this.$el = options.el;
        this.$data = options.data;
        let methods = options.methods;
        let computed = options.computed;
        if(this.$el){
            for(let key in methods){
                Object.defineProperty(this.vm,key,{
                    get(){
                        return methods[key]
                    }
                })
            }
            for(let key in computed) {
                Object.defineProperty(this.$data,key,{
                    get:()=>{
                        return computed[key].call(this)
                    }
                })
            }
            this.proxyData()
            new Observer(this.$data)
            new Compiler(this.$el,this)
        }
        
    }
    proxyData(){
        for(let key in this.$data){
            Object.defineProperty(this,key,{
                get:()=>{
                    return this.$data[key]
                },
                set:(newValue)=>{
                    if(this.$data[key]===newValue) return;
                    this.$data[key] = newValue;
                }
            })
        }
    }
}
class Compiler {
    constructor(el,vm){
        this.vm = vm;
        this.node = this.isElement(el)?el:document.querySelector(el)
        let fragement = this.node2Fragement(this.node);
        this.compile(fragement);
        this.node.appendChild(fragement);
    }
    isElement(el){
        return el.nodeType===1
    }
    isDirective(str){
        return str.startsWith('v-');
    }
    node2Fragement(node){
        const fragement = document.createDocumentFragment();
        let firstChild;
        while(firstChild = node.firstChild){
            fragement.appendChild(firstChild)
        }
        return fragement;
    }
    compile(fragement){
        [...fragement.childNodes].forEach(node=>{
            if(this.isElement(node)){
                this.elementCompile(node)
                this.compile(node)
            }else{
                this.textCompile(node)
            }
        })
    }
    elementCompile(node){
        const attributes = node.attributes;
        [...attributes].forEach(attr=>{
            const {name,value:expr} = attr;
            if(this.isDirective(name)){
                const [,directive] = name.split('-');
                const [directiveName,eventName] = directive.split(':')
                CompileUtil[directiveName](this.vm,node,expr,eventName);
            }
        })
    }
    textCompile(text){
        const content = text.textContent;
        if(/\{\{(.*)\}\}/.test(content)){
            CompileUtil.text(this.vm,text,content)
        }
    }
}

class Observer {
    constructor(data){
        this.data = data;
        this.observe(data)
    }
    observe(data){
        if(data&&typeof data =='object'){
            for(let key in data ){
                this.defineReactive(data,key,data[key])
            }
        }
    }
    defineReactive(obj,key,value){
        this.observe(value)
        const dep = new Dep()
        Object.defineProperty(obj,key,{
            get(){
                Dep.target && dep.addSub(Dep.target)
                return value
            },
            set:(newValue)=>{
                if(newValue===value) return
                this.observe(newValue)
                value = newValue;
                dep.notify();
            }
        })
    }
}
// this.$watcher(vm,'expr',cb)
class Watcher {
    constructor(vm,expr,cb){
        this.vm=vm;
        this.expr = expr;
        this.cb = cb;
        this.oldValue = this.get();
    }
    get(){
        Dep.target=this;
        const value = CompileUtil.getValue(this.vm,this.expr);
        Dep.target = null
        return value
    }
    update(){
        const newValue = CompileUtil.getValue(this.vm,this.expr);
        if(newValue===this.oldValue) return;
        this.cb.call(this.vm,newValue);
    }
}

class Dep {
    constructor(){
        this.subs = []
    }
    addSub(watcher){
        this.subs.push(watcher)
    }
    notify(){
        this.subs.forEach(watcher=>watcher.update())
    }
}

const CompileUtil = {
    getValue(vm,expr){
       return expr.split('.').reduce((data,current)=>{
            return data[current]
        },vm.$data)
    },
    setValue(vm,expr,value){
        expr.split('.').reduce((data,current,index,arr)=>{
            if(index === arr.length-1)  data[current] = value;
            return data[current]
        },vm.$data)
    },
    model(vm,node,expr){
        const fn = this.updater.modeUpdater;
        const value = this.getValue(vm,expr);
        new Watcher(vm,expr,(newValue)=>{
            fn(node,newValue)
        })
        node.addEventListener('input',e=>{
            this.setValue(vm,expr,e.target.value)
        })
        fn(node,value);
    },
    on(vm,node,expr,eventName){
        node.addEventListener(eventName,e=>{
            vm[expr].call(vm,e);
        })
    },
    getContentValue(vm,expr){
        return expr.replace(/\{\{(.*)\}\}/g,(...args)=>{
            return this.getValue(vm,args[1])
        })
    },
    text(vm,node,expr){
        const fn = this.updater.textUpdater;
        const value = expr.replace(/\{\{(.*)\}\}/g,(...args)=>{
            new Watcher(vm,args[1],()=>{
                fn(node,this.getContentValue(vm,expr))
            })
            return this.getValue(vm,args[1])
        })
        fn(node,value);
    },
    html(vm,node,expr){
        const fn = this.updater.htmlUpdater;
        const value = this.getValue(vm,expr);
        fn(node,value)
    },
    updater:{
        modeUpdater(node,value){
            node.value=value;
        },
        textUpdater(node,value){
            node.textContent=value
        },
        htmlUpdater(node,value){
            node.innerHTML= value;
        }
    }
}