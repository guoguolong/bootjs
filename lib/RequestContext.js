/**
 * RequestContext.js
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2017 Kaulware.com
 */
'use strict';
let _ = require('lodash');

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
        htmlRender: function(data, layout, viewPath) {
            if (mvcObj.bundleName) {
                if (layout === undefined && bundleConfig.layoutPath) layout = {
                    layout: path.normalize(bundleConfig.htmlLayoutPath || bundleConfig.layoutPath)
                };
                if (data == undefined) data = {};
            }
            mvcObj.res.htmlRender(data, layout, viewPath);
        },
        tuniuRender: function(data, layout, viewPath) {
            if (mvcObj.bundleName) {
                if (layout === undefined && bundleConfig.layoutPath) layout = {
                    layout: path.normalize(bundleConfig.tuniuLayoutPath || bundleConfig.layoutPath)
                };
                if (data == undefined) data = {};
            }
            mvcObj.res.tuniuRender(data, layout, viewPath);
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
        getAssetUrl: function(url) {
            url = url || '';
            if (url.match(/^\//) && url !== '/') return url;
            let entryPath = (mvcObj.req.header('virtual-path') || '') + (bundleConfig.entryPath || '');
            let basePath = bundleConfig.baseUrl || entryPath || '';
            if (!basePath.match(/\/$/)) {
                basePath += '/';
            }
            url = basePath + url;
            url = url.replace(/\/+$/, '/');
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
    if (mvcObj.ctrlObj) {
        ctx.bundle = Bundle(mvcObj, pluginObj.config.bundles[mvcObj.bundleName]);
    }
    ctx.bundle = constructBundle(ctx, mvcObj, pluginObj.config.bundles[mvcObj.bundleName]);
    ctx.getService = function(serviceName, bundleName, params, reload) {
        if (pluginConf.services && pluginConf.services[serviceName]) { // 有配置读取配置
            let serviceConf = pluginConf.services[serviceName];
            serviceName = serviceConf.moduleName || serviceName;
            bundleName = serviceConf.bundleName || bundleName;
            params = serviceConf.params || params;
            reload = serviceConf.reload || reload;
        } else { // 读取参数
            if (_.isObject(arguments[1])) {
                bundleName = arguments[1].bundleName;
                params = arguments[1].params;
                reload = arguments[1].reload;
            }
        }
        let srvKey  = bundleName + serviceName;
        if (reload !== true) {
            if (!ctx.services[srvKey]) reload = true;
        }
        if (reload === true) {
            let srvObj = pluginObj.createService.call({ctx}, serviceName, bundleName, params);
            ctx.services[srvKey] = srvObj;
        }
        return ctx.services[srvKey];
    };

    return ctx;
}