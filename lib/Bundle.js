/**
 * Bundle.js
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2006-2017 Kaulware.com
 */
'use strict';

const common = require('bootjs-common');
const _ = require('lodash');
const path = require('path');
const url = require('url');

module.exports = function(mvcObj, bundleConfig) {
    let ctx = mvcObj.ctrlObj.ctx;
    bundleConfig = bundleConfig || {};
    return {
        config: bundleConfig,
        importModel: function(modelJs) {
            return ctx.importModel(modelJs, mvcObj.bundleName);
        },
        loadView: function(viewFilePath) {
            return ctx.loadView(viewFilePath, mvcObj.bundleName);
        },
        htmlRender: function (data, layout, viewPath) {
            if (mvcObj.bundleName) {
                if (layout === undefined) layout = {layout: path.normalize(bundleConfig.layoutPath)};
                if (data == undefined) data = {};
            }
            mvcObj.res.htmlRender(data, layout, viewPath);
        },
        forward: function (path, params) {
            path = bundleConfig.entryPath + path;
            mvcObj.res.forward(path, params);
        },
        getService: function (serviceName, params, reload) {
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