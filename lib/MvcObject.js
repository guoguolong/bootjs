/**
 * 每次http请求创建的Mvc对象.
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2017 Kaulware.com
 */
'use strict';

const common = require('bootjs-common');
const _ = require('lodash');
const path = require('path');
const BundleLoader = require('./BundleLoader');

class MvcObject {
    constructor(bootjs) {        
        this.bootjs = bootjs;
        this.bundleName = '';
        this.relSearchDir = '';
        this.url = '';
        this.ctrlName = '';
        this.actionName = '';
        this.viewPath = '';
        this.urlsPrefix = bootjs.config.router.urlsPrefix;
        this.autoUrlPrefix = bootjs.config.router.autoUrlPrefix;
        this.defaultControllerName = bootjs.config.router.default.controllerName;
        this.defaultActionName = bootjs.config.router.default.actionName;

        this.ctrlObj = null;
        this.controllersBaseDir = bootjs.config.layout.controllers.baseDir;
        this.viewsBaseDir = bootjs.config.layout.views.baseDir;
        this.modelsBaseDir = bootjs.config.layout.models.baseDir;
        this.configsBaseDir = bootjs.config.layout.configs.baseDir;
        this.urlParamPos = 2;
        this.urlInfos = [];
        this.initParams = {}; // controller类的参数args
        this.params = []; // action方法的参数args
        this.bundlePrefix =  '';
    }

    splitUrl(arr, url) {
        let firstSeg = '';
        arr.some(function(item) {
            if (item == url) {
                url = '';
                firstSeg = item;
                return true;
            } else {
                let reg = new RegExp('^' + item + '/');
                if ((url + '/').match(reg)) {
                    firstSeg = item;
                    url = url.replace(reg, '');
                    return true;
                }
            }
        });
        return {
            firstSeg: firstSeg,
            url: url
        };
    }

    loadController() {
        let error = false;
        // autoUrlPrefix = false, 解析url是否与配置文件中的urlsPrefix声明有匹配
        if (!this.autoUrlPrefix) {
            let segments = this.splitUrl(this.urlsPrefix, this.url);
            this.relSearchDir = segments.firstSeg;
            this.url = segments.url;
        }

        let urlInfos = this.url.split('/');
        // 默认路由到 IndexController.js的index()方法
        urlInfos[0] = urlInfos[0] || this.defaultControllerName;
        urlInfos[1] = urlInfos[1] || this.defaultActionName;

        if (this.autoUrlPrefix) { 
            let ctrlInfos = urlInfos[0].split('_');
            urlInfos[0] = ctrlInfos.pop();
            this.relSearchDir = ctrlInfos.join('/');
        }
        // 1. 优先从controller基目录下寻找controller文件.
        error = this._requireController(urlInfos[0], urlInfos[1]);
        if (error instanceof Error) {
            // 如果是编译错误,不进行二级目录查找.
            if (common.utils.hasCompileError(error)) return error;
            // autoUrlPrefix=true，不尝试子目录查找
            if (this.autoUrlPrefix) return error;
            this.relSearchDir += '/' + urlInfos[0];

            // 2 尝试下一级子目录寻找controller文件.
            error = this._requireController(urlInfos[1], urlInfos[2]);
            if (error instanceof Error) return error;
            this.urlParamPos = 3;
        }
        this.urlInfos = urlInfos;
        return error;
    }

    loadBundle(bundleName, bundlePrefix) {
        let bundleLoader = BundleLoader(this.bootjs);
        let bundleConf = bundleLoader.load(bundleName, bundlePrefix);

        this.bundleName = bundleName;
        this.bundlePrefix = bundlePrefix;
        
        this.configsBaseDir = bundleConf.baseDir + '/config/';
        this.controllersBaseDir = bundleConf.baseDir + '/controllers/';
        this.viewsBaseDir = bundleConf.baseDir + '/views/';
        this.modelsBaseDir = bundleConf.baseDir + '/models/';
        
        this.urlsPrefix = bundleConf.default.urlsPrefix || this.urlsPrefix;
        this.autoUrlPrefix = bundleConf.default.autoUrlPrefix || this.autoUrlPrefix;
        this.defaultControllerName = bundleConf.default.controllerName || this.defaultControllerName;
        this.defaultActionName = bundleConf.default.actionName || this.defaultActionName;

        this.bootjs.config.bundles[bundleName] = bundleConf;
        return bundleConf;
    }

    _requireController(ctrlNameKey, actionNameKey) {
        let searchDir = this.controllersBaseDir + this.relSearchDir;
        try {
            actionNameKey = actionNameKey || this.defaultActionName;
            ctrlNameKey = ctrlNameKey || this.defaultControllerName;
            this.ctrlName = _.upperFirst(_.camelCase(ctrlNameKey));
            let ctrlClass = require(path.normalize(searchDir + '/' + this.ctrlName + 'Controller.js'));
            this.ctrlObj = new (ctrlClass);
            this.ctrlObj.params = {};
            if (this.initParams) {
                Object.keys(this.initParams).forEach(function(key) {
                    this.ctrlObj.params[key] = this.initParams[key];
                }.bind(this));
            }            
            this.actionName = _.camelCase(actionNameKey);
            this.viewPath = this.relSearchDir + '/' + ctrlNameKey + '/' + this.actionName;
            this.viewPath = this.viewPath.replace(/^\//, '');
            if (this.bundleName) {
                this.viewPath = this.viewsBaseDir + this.viewPath;
            }
        } catch (e) {
            return e;
        }
        return false;
    }
}
module.exports = MvcObject;
