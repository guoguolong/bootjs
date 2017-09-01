/**
 * RequestContext.js
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2017 Kaulware.com
 */
'use strict';
const _ = require('lodash');
const path = require('path');
const url = require('url');
const common = require('bootjs-common');

function constructBundle(ctx, mvcObj, bundleConfig) {
    bundleConfig = bundleConfig || {};
    return {
        config: bundleConfig,
        importModel: function(modelJs) {
            return ctx.importModel(modelJs, mvcObj.bundleName);
        },
        loadView: function(viewFilePath) {
            return ctx.loadView(viewFilePath, mvcObj.bundleName);
        },
        htmlRender: function(data, layout, viewPath, callback) {
            if (mvcObj.bundleName) {
                if (layout === undefined && bundleConfig.layoutPath) layout = {
                    layout: path.normalize(bundleConfig.htmlLayoutPath || bundleConfig.layoutPath)
                };
                if (data == undefined) data = {};
            }
            mvcObj.res.htmlRender(data, layout, viewPath, callback);
        },
        autoRender: function(data, layout, viewPath, callback) {
            if (mvcObj.bundleName) {
                if (layout === undefined && bundleConfig.layoutPath) layout = {
                    layout: path.normalize(bundleConfig.htmlLayoutPath || bundleConfig.layoutPath)
                };
                if (data == undefined) data = {};
            }
            mvcObj.res.autoRender(data, layout, viewPath, callback);
        },
        forward: function(path, params) {
            path = bundleConfig.entryPath + path;
            mvcObj.res.forward(path, params);
        },
        getService: function(serviceName, params, reload) {
            return ctx.getService(serviceName, mvcObj.bundleName, params, reload);
        },
        getViewPath: function(path) {
            return mvcObj.viewsBaseDir + path;
        },
        getAutoAssetUrl: function(url, withHostPrefix = false) {
            url = url || '';
            if (url.match(/^\//) && url !== '/') {
                // return url;
            } else {
                let entryPath = (mvcObj.req.header('virtual-path') || '') + (bundleConfig.entryPath || '');
                let basePath = bundleConfig.baseUrl || entryPath || '';
                if (!basePath.match(/\/$/)) {
                    basePath += '/';
                }
                url = basePath + url;
                url = url.replace(/\/+$/, '/');
            }
            if (withHostPrefix) {
                ctx.req.headers = ctx.req.headers || {};
                let protocol = ctx.req.headers['x-forwarded-proto'] || ctx.req.headers['tuniu-ssl-session-tag'] || ctx.req.protocol || 'http';
                protocol = protocol.toLowerCase();
                let prefix = protocol + '://' + ctx.req.hostname;
                if (ctx.req.port) {
                    prefix += ':' + ctx.req.port;
                }
                url = prefix + url;
            }
            return url;
        }
    }
};

module.exports = function(pluginObj, mvcObj) {
    let pluginConf = pluginObj.config;

    let ctx = Object.assign({
        req: mvcObj.req,
        res: mvcObj.res,
        next: mvcObj.next,
        services: {},
        importModel: pluginObj.importModel,
        loadView: pluginObj.loadView,
        loadPackedViewJsP: pluginObj.loadPackedViewJsP,
    }, pluginObj.getAppContext());

    ctx.bundle = constructBundle(ctx, mvcObj, pluginObj.config.bundles[mvcObj.bundleName]);
    ctx.getAutoAssetUrl = ctx.bundle.getAutoAssetUrl;
    ctx.getAssetUrl = pluginObj.getAppContext('getAssetUrl');
    ctx.getService = function(serviceName, bundleName, params, reload) {
        let moduleName;
        if (pluginConf.services && pluginConf.services[serviceName]) { // 有配置读取配置
            let serviceConf = pluginConf.services[serviceName];
            serviceName = serviceConf.serviceName || serviceName;
            bundleName = serviceConf.bundleName || serviceConf.bundle || bundleName;
            moduleName = serviceConf.moduleName || serviceConf.module;
            params = serviceConf.params || params;
            reload = serviceConf.reload || reload;
        } else { // 读取参数
            if (_.isObject(arguments[1])) {
                bundleName = arguments[1].bundleName || arguments[1].bundle;
                moduleName = arguments[1].moduleName || arguments[1].module;
                params = arguments[1].params;
                reload = arguments[1].reload;
            }
        }
        let srvKey = (bundleName || moduleName) + serviceName;
        if (reload !== true) {
            if (!ctx.services[srvKey]) reload = true;
        }
        if (reload === true) {
            let srvObj = pluginObj.createService.call({
                ctx
            }, serviceName, {
                bundleName: bundleName,
                moduleName: moduleName,
                params: params,
            });
            ctx.services[srvKey] = srvObj;
        }
        return ctx.services[srvKey];
    };

    return ctx;
}