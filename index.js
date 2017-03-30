"use strict";

const common = require('bootjs-common');
const fs = require('fs');
const path = require('path');
const co = require('co');
const _ = require('lodash');
const isGenerator = require('is-type-of').generatorFunction;
const RequestContext = require('./lib/RequestContext');
const BundleLoader = require('./lib/BundleLoader');

module.exports = function(app, pluginConf) {
    let pluginObj = null;
    let appCtx = {};

    function preLoadBundles(bootjs) {
        let bundleLoader = BundleLoader(bootjs);
        Object.keys(pluginConf.bundles).forEach(function(bundleName) {
            if (pluginConf.bundles[bundleName].preLoad === true) {
                pluginConf.thirdPartyBundle.prefixes.forEach(function(prefix) {
                    bundleLoader.load(bundleName, prefix);
                });
            }
        });
    }

    function normalizeMappingConfig() { // 整理urlsMapping配置格式.
        Object.keys(pluginConf.router.urlsMapping).forEach(function(key) {
            let mapping = pluginConf.router.urlsMapping[key];
            if (_.isString(mapping)) {
                mapping = {
                    target: mapping
                }
            }
            mapping.source = mapping.source || key;
            pluginConf.router.urlsMapping[key] = parseRouteItem(mapping);
        });

    }

    function normalizePluginConfig() {
        if (!pluginConf.baseDir) return false;

        // 顶层节点默认值.
        pluginConf.router = pluginConf.router || {};
        pluginConf.router.urlsMapping = pluginConf.router.urlsMapping || {};
        pluginConf.router.default = pluginConf.router.default || {};
        pluginConf.router.urlsPrefix = pluginConf.router.urlsPrefix || [];
        
        pluginConf.name = pluginConf.name || 'bootjs';
        pluginConf.env = pluginConf.env || 'prod';

        // 路由的默认设置检查.
        pluginConf.router.default.bundleName = pluginConf.router.default.bundleName || '';
        pluginConf.router.default.controllerName = pluginConf.router.default.controllerName || 'index';
        pluginConf.router.default.actionName = pluginConf.router.default.actionName || 'index';

        // 目录布局：bundles,controllers,models,views,config
        pluginConf.layout = pluginConf.layout || {};
        pluginConf.layout.controllers = pluginConf.layout.controllers || {};
        pluginConf.layout.controllers.baseDir = pluginConf.layout.controllers.baseDir || (pluginConf.baseDir + 'controllers/');

        pluginConf.layout.configs = pluginConf.layout.configs || {};
        pluginConf.layout.configs.baseDir = pluginConf.layout.configs.baseDir || (pluginConf.baseDir + 'config/');

        pluginConf.layout.models = pluginConf.layout.models || {};
        pluginConf.layout.models.baseDir = pluginConf.layout.models.baseDir || (pluginConf.baseDir + 'models/');

        pluginConf.layout.views = pluginConf.layout.views || {};
        pluginConf.layout.views.baseDir = pluginConf.layout.views.baseDir || (pluginConf.baseDir + 'views/');

        pluginConf.layout.bundles = pluginConf.layout.bundles || {};
        pluginConf.layout.bundles.baseDir = pluginConf.layout.bundles.baseDir || (pluginConf.baseDir + 'bundles/');

        // views设定
        pluginConf.views = pluginConf.views || {};
        pluginConf.views.engine = pluginConf.views.engine || 'ejs';

        pluginConf.thirdPartyBundle = pluginConf.thirdPartyBundle || {};
        pluginConf.thirdPartyBundle.prefixes = pluginConf.thirdPartyBundle.prefixes || ['bootjs-bundle-', ''];

        // bundle设定
        pluginConf.bundles = pluginConf.bundles || {};
        // 加载当前项目bundles基本信息.
        if (fs.existsSync(pluginConf.layout.bundles.baseDir)) {
            let dir = fs.readdirSync(pluginConf.layout.bundles.baseDir);
            dir.forEach(function(name) {
                let stats = fs.statSync(pluginConf.layout.bundles.baseDir + name);
                if (!name.match(/^\./) && stats.isDirectory()) {
                    pluginConf.bundles[name] = pluginConf.bundles[name] ||  {};
                    Object.assign(pluginConf.bundles[name], {
                        baseDir: fs.realpathSync(pluginConf.layout.bundles.baseDir + name),
                        isLoaded: false,
                    });
                }
            });
        }
        //解析配置文件url前缀分组节点使其正式化(去除不规范的写法).
        pluginConf.router.urlsPrefix = pluginConf.router.urlsPrefix.map(item => {
            return item.replace(/^\//, '').replace(/\/*$/, '');
        });

        // 插件：user auth.
        pluginConf.auth = pluginConf.auth || {};
        pluginConf.auth.enabled = pluginConf.auth.enabled || true;
        pluginConf.auth.module = pluginConf.auth.module || 'bootjs-auth';

        // 插件：exception
        if (typeof pluginConf.exception !== 'object') {
            pluginConf.exception = { enabled: pluginConf.exception};
        }
        // pluginConf.exception = pluginConf.exception || { enabled: true};
        if (pluginConf.exception.enabled !== false) {
            pluginConf.exception.enabled = true;
        }
        pluginConf.exception.module = pluginConf.exception.module || 'bootjs-exception';

        return true;
    }

    /** @param url could be String or urlsMapping object. **/
    function loadMVC(url, req, res, next) {
        let MvcObject = require('./lib/MvcObject');
        let mapping = {};
        if (!_.isString(url)) {
            mapping = url;
            url = mapping.target;
        }
        if (typeof req.params === 'object') {
            Object.keys(req.params).forEach(function(k) {
                let regexp = new RegExp('\\$\\{'+ k + '\\}', 'g');
                url = url.replace(regexp, req.params[k]);
            });
        }
        try {
            url = decodeURI(url);
        } catch(e) {
            console.warn('Invalid decodeURI:' , url);
        }
        let urlSegs = url.split('?'); // 去掉get参数.
        url = urlSegs[0].replace(/^\/*/, '').replace(/\/*$/, ''); // 去掉首部和尾部/符号.

        let mvcObj = new (MvcObject)(pluginObj);
        mvcObj.originalUrl = mvcObj.url = url;
        mvcObj.initParams = mapping.params;
        mvcObj.req = req;
        mvcObj.res = res;
        mvcObj.next = next;

        let error = mvcObj.loadController();
        if (error) { // 如果出错， 尝试bundles方式加载.
            mvcObj.originalUrl = mvcObj.url = url;
            let urlSegs = url.split('/');
            if (!pluginConf.bundles[urlSegs[0]]) pluginConf.bundles[urlSegs[0]] = null;
            let segments = mvcObj.splitUrl(Object.keys(pluginConf.bundles), url);
            if (segments.firstSeg) {
                let isLoaded = false;
                pluginConf.thirdPartyBundle.prefixes.forEach(function(prefix) {
                    if (isLoaded) return;
                    try {
                        mvcObj.loadBundle(segments.firstSeg, prefix);
                        mvcObj.url = segments.url;
                        error = mvcObj.loadController();
                        if (error) {
                            res.statusCode = 404;
                            return error;
                        }
                        isLoaded = true;
                        error = null; // 清除错误.
                    } catch (e) {
                        if (common.utils.hasCompileError(e)) {
                            isLoaded = true;
                            res.statusCode = 500;
                        } else {
                            res.statusCode = 404;
                            let bundlePath = mvcObj.bundlePrefix + segments.firstSeg;
                            if (pluginConf.thirdPartyBundle.isLocal) {
                                bundlePath = pluginConf.localModuleBaseDir + bundlePath;
                                bundlePath = path.normalize(bundlePath);
                            }
                            console.warn('[WARN] Failed to load bundle "' +  bundlePath + '", ignored it.');
                        }
                        return error; // 不显示加载bundle错误.
                    }
                });
                if (error) return error;
            } else {
                res.statusCode = 404;
                return error;                
            }
        }

        // 如果params[0]就是原始url，那么使用自动映射规则解析参数
        let firstParam = req.params[0];
        if (req.params[0]) firstParam = req.params[0].replace(/\/*$/, '');
        if (firstParam === mvcObj.originalUrl.replace(/\/*$/, '')) {
            mvcObj.params = mvcObj.urlInfos.slice(mvcObj.urlParamPos);
        } else { // 否则，把params对象中文解码后复制到动作方法参数中.
            if (_.isArray(mapping.paramSeq)) {
                mvcObj.params = mapping.paramSeq.map(argName => {
                    return req.params[argName];
                });
            } else {
                mvcObj.params = Object.keys(req.params).map(key => {
                    return req.params[key];
                });
            }
        }
        error = callAction(mvcObj);
        return error;
    }

    function callAction(mvcObj) {
        let error = false;
        // 加载找到的模块文件，并执行对应的action方法.
        let ctx = RequestContext(pluginObj, mvcObj);
        // 便利方法
        let ctrlObj = mvcObj.ctrlObj;
        ctrlObj.req = mvcObj.req;
        ctrlObj.res = mvcObj.res;
        ctrlObj.ctx = ctx;

        ctrlObj.next = mvcObj.next;
        ctrlObj.bundle = ctx.bundle;

        ctrlObj.res.locals.__viewPath__ = mvcObj.viewPath; // 给bootjs-render的autoViewPath使用.
        ctrlObj.res.locals.AssetUrl = ctx.bundle.getAssetUrl;
        ctrlObj.res.locals.req = mvcObj.req;
        ctrlObj.res.locals.res = mvcObj.res;
        ctrlObj.res.locals.ctx = ctx;


        let actionMethod = ctrlObj[mvcObj['actionName']];
        if (typeof actionMethod === 'function') {
            if (/^_/.test(mvcObj['actionName'])) {
                return new Error(mvcObj['actionName'] + ' is not valid action method.');
            } 
            if (_.isFunction(ctrlObj.__construct)) {
                ctrlObj.__construct();
            }

            //判断获取到的类实例函数为Generator,则进行wrap
            if (isGenerator(actionMethod)) {
                actionMethod = co.wrap(actionMethod);
            }
            let dataRes = actionMethod.apply(ctrlObj, mvcObj.params);
            //框架内针对co.wrap后的普通函数中出现的运行时错误进行错误异常捕获
            function isPromise(obj) {
                obj = typeof obj === 'object' && obj || {};
                return typeof obj.then === 'function';
            }            
            if (isPromise(dataRes)) dataRes.catch(err=> mvcObj.next(err));

            if (dataRes && typeof dataRes === 'object' && (!isPromise(dataRes))) {
                if (dataRes.constructor.name === 'ApiResponse') { // 渲染 json view.
                    ctrlObj.res.apiRender(dataRes);
                } else { // 渲染web view
                    if (dataRes.viewPath) {
                        mvcObj.viewPath = dataRes.viewPath;
                    }
                    ctrlObj.res.htmlRender(dataRes, true, mvcObj.viewPath);
                }
            }
        } else {
            let message = '[404 Exception] Action method ' + mvcObj['ctrlName'] + 'Controller' + '.' + mvcObj['actionName'] + '() is not found.';
            ctrlObj.res.statusCode = 404;
            error = new Error(message);
        }
        return error;
    }

    function addRoute(mapping) {
        // mapping.source 可能是string，也可能是RegExp;
        mapping.method = mapping.method || 'all';
        mapping.auth = mapping.auth || {enabled: false};
        if (mapping.auth === true) {
            mapping.auth = {enabled: true};
        } else if (typeof mapping.auth === 'function') {
            mapping.auth = {
                enabled: true,
                middleware: mapping.auth
            };
        }
        mapping.auth.module = mapping.auth.module || pluginConf.auth.module;
        let tailMiddleware = function(req, res, next) {
            if (mapping.isAuto === true) mapping.target = req.url;
            let err = loadMVC(mapping, req, res, next);
            if (err instanceof Error) {
                next(err);
            }
        };
        if (mapping.auth.enabled) {
            if (!mapping.auth.middleware) {
                mapping.auth.middleware = function(req, res, next) {
                    return co(function* (){
                        let hasLogin = yield req.auth.hasLoginP();
                        if (hasLogin) {
                            return next();                        
                        }

                        let returnUrl;
                        if (mapping.auth.ajax === true) {
                            returnUrl = mapping.auth.ajaxFailureUrl || pluginConf.auth.ajaxFailureUrl;
                            if (!returnUrl) {
                                let apiResp = new common.ApiResponse();
                                apiResp.setCode(common.Error.codes.USER_NOT_LOGIN);
                                return res.apiRender(apiResp);
                            }
                        } else {
                            returnUrl = mapping.auth.webFailureUrl || pluginConf.auth.webFailureUrl || req.auth.getLoginUrl();
                        }
                        return res.end('<script>window.location = "' + returnUrl + '";</script>');
                    });
                };
            }
            app[mapping.method](mapping.source, mapping.auth.middleware, tailMiddleware);
        } else {
            app[mapping.method](mapping.source, tailMiddleware);
        }
    }

    /**
     * 解析配置文件中的一个条目，分解到规范化的对象里
     * @returns object
     * {
     *      target: string
     *      source: <string>|<RegExp>
     *      method: all|get|post
     *      type: regexp|string|null
     *      paramSeq: []|null
     * }
     */
    function parseRouteItem(item) {
        if (_.isString(item)) {
            item = {
                source: item,
                target: item,
            };
        }
        if (item.type && item.type == 'regexp') item.source = new RegExp(item.source);
        item.method = item.method || 'all';
        item.target = item.target || item.source;
        item.paramSeq = item.paramSeq || null;
        return item;
    }

    function importModel(modelJs, bundleName) {
        let baseDir = pluginConf.layout.models.baseDir;
        if (typeof bundleName === 'string' && bundleName !== '') {
            baseDir = pluginConf.bundles[bundleName].baseDir + '/models/';
        }
        let pkg = common.package([path.normalize(baseDir)]);
        return pkg.import(modelJs);
    }

    function loadView(viewPath, bundleName) {
        let baseDir = pluginConf.layout.views.baseDir;
        if (typeof bundleName === 'string' && bundleName !== '') {
            baseDir = pluginConf.bundles[bundleName].baseDir + '/views/';
        }
        let pkg = common.package([path.normalize(baseDir)]);
        return pkg.loadView(viewPath);
    }

    return {
        app: app, // 持有app句柄
        config: pluginConf,
        setAppContext: function(name, value) {
            appCtx = this.getAppContext();
            if (value) {
                appCtx[name] = value;
            } else {
                if(typeof name === 'object') {
                    let props = name;
                    for (let key in props) {
                        appCtx[key] = props[key];
                    }
                }
            }
            return this;
        },
        getAppContext: function(name) {
            if (name) {
                return appCtx[name];
            }
            return appCtx;
        },
        createContext: function(req, res, next) {
            return RequestContext(pluginObj, {
                req, res, next
            });
        },
        createService: function(serviceName, bundleName, params) {
            if (pluginConf.services && pluginConf.services[serviceName]) { // 有配置就读取配置
                let serviceConf = pluginConf.services[serviceName];
                serviceName = serviceConf.moduleName || serviceName;
                bundleName = serviceConf.bundleName || bundleName;
                params = serviceConf.params || params;
            } else { // 读取参数
                if (_.isObject(arguments[1])) {
                    bundleName = arguments[1].bundleName;
                    params = arguments[1].params;
                }
            }            
            let SrvClass = importModel(serviceName, bundleName);
            if (!_.isFunction(SrvClass)) {
                throw new Error(serviceName + ' is not found.');
            }
            let srvObj = new (SrvClass);
            srvObj.params = {};
            srvObj.ctx = pluginObj.getAppContext();
            if (this.ctx) { // 动态指定上下文
                srvObj.ctx = this.ctx;
            }

            if (params) {
                Object.keys(params).forEach(function(key) {
                    srvObj.params[key] = params[key];
                });
            }
            if (_.isFunction(srvObj.__construct)) {
                srvObj.__construct();
            }
            return srvObj;
        },
        importModel: importModel,
        loadView: loadView,
        loadPackedViewJsP: function(jsFile) {
            let baseDir = pluginObj.config.packedViewJsBaseDir || '';
            return require(path.resolve(baseDir + jsFile))();
        },
        addRoute: addRoute,
        addRoutes: function() {
            pluginObj = this;
            normalizeMappingConfig();
            // 注入forward方法到res.
            app.use(function(req, res, next) {
                res.forward = function(url, params) {
                    if (res.mvcObj && res.mvcObj.params) {
                        req.params = res.mvcObj.params;
                    }
                    if (typeof params === 'object') {
                        req.params = params;
                    }
                    let err = loadMVC(url, req, res, next);
                    if (err instanceof Error) {
                        next(err);
                    }
                };
                next();
            });
            // 0. 认证模块.
            if (pluginConf.auth.enabled) {
                let UserAuth = this.getAppContext('UserAuth');
                app.use(function(req, res, next) {
                    UserAuth.create(req, res, next);
                    next();
                });
            }
            // 1. 配置路由 .
            Object.keys(pluginConf.router.urlsMapping).forEach(function(key) {
                addRoute(pluginConf.router.urlsMapping[key]);
            });
            // 2. 代码路由. @TODO： 暂不支持bundles下的router.js.
            let jsFiles = common.utils.walk(pluginConf.layout.controllers.baseDir, 'router.js', []);
            jsFiles.forEach(function(jsFile) {
                // 加载指定目录的路由文件.
                require(jsFile)(pluginObj);
            });
            // 3. 自动映射路由.
            addRoute({source: '/*', isAuto: true});

            // 4. 可选加载其他路由
            if (pluginConf.exception.enabled) {
                app.use(require(pluginConf.exception.module)(pluginConf.exception));
            }

        },
        init: function(appConfig, options) {
            options = options || {};
            pluginObj = this;
            // 正规化插件配置文件
            if (!normalizePluginConfig()) {
                console.error('[Error] bootjs configuration [baseDir] is missed.');
                return false; // 配置文件非法，加载失败
            }
            // 再次设置views的查找根目录
            app.set('views', pluginConf.layout.views.baseDir);
            app.set('view engine', pluginConf.views.engine);
            
            // 加载认证模块.
            if (pluginConf.auth.enabled) {
                this.setAppContext('UserAuth', require(pluginConf.auth.module)(pluginConf.auth));
            }
            this.setAppContext(pluginConf.name, pluginObj);
            this.setAppContext('app', app);
            if (appConfig) {
                this.setAppContext('config', appConfig);
            }
            this.setAppContext('createService', pluginObj.createService);
            if (options.contexts) {
                for (let name in options.contexts) {
                    this.setAppContext(name, options.contexts[name]);
                }
            }

            // 预加载bundle.
            preLoadBundles(this);

            // 全局注入一些方法.
            global.importModel = importModel;
            return true;
        },
        run: function() {
            if (!this.init()) {
                return false;
            }
            this.addRoutes();
            return true;
        }
    }
};