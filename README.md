# bootjs
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/guoguolong/bootjs/master/LICENSE)

A lightweight web framework based on Node.js and Express.js

![bootjs logo](https://github.com/guoguolong/bootjs/raw/master/docs/logo-300.png)

Below is a minimal bootjs web application. Suppose we have a project named 'hello', here is the project folder layout:
```
[app]
  |_config.js // configuration file.
  |_[src] 
  |   |_ [controllers]
  |         |_ IndexController.js
app.js // bootstrap file.
package.json
```
## Step 1: Intallation.

>cnpm install express
>
>cnpm install bootjs

Or you can make a package.json as below:
``` json
{
  "name": "hello",
  "version": "1.0.0",
  "description": "minimal web project based on bootjs ",
  "main": "app.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Allen Guo",
  "license": "MIT",
  "dependencies": {
    "bootjs": "^0.1.6",
    "express": "^4.14.1"
  }
}
```

## Step 2: Edit config.js
``` javascript
'use strict';
module.exports = {
    baseDir: __dirname + '/app/src/' // Mandatory item.
}
```

## Step 3: Edit app.js

``` node
'use strict';

const express = require('express');
const app = express();
const Bootjs = require('bootjs');
const config = require('./config.js');

const bootjs = Bootjs(app, config);

// initialize bootjs.
bootjs.init();

// add routes to bootjs.
bootjs.addRoutes(); 

app.listen(5000, () => {
    console.log('A http server started at localhost:5000.');
}); 
```

## Step 4: Write a sample.

### Create a app/src/IndexController.js as below:
``` node 
'use strict';
module.exports = class {
    index() {
        this.res.end('Hello Bootjs');
    }
}
```

### Start boojs server and access page.

Enter project folder then run 
>node app.js

Go to browser and enter <http://localhost:5000>, you will got a page which say 'Hello Bootjs'.

[MIT](LICENSE)
