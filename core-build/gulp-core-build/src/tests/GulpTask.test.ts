// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

'use strict';

import { assert, expect } from 'chai';
import gutil = require('gulp-util');
import * as Gulp  from 'gulp';
import { Readable } from 'stream';
import * as path from 'path';

import {
  serial,
  parallel,
  GulpTask
} from '../index';
import { mockBuildConfig } from './mockBuildConfig';

interface IConfig {
}

let testArray: string[] = [];

class PromiseTask extends GulpTask<IConfig> {
  public name: string = 'promise';

  public taskConfig: IConfig = {
  };

  /* tslint:disable:no-any */
  public executeTask(gulp: typeof Gulp): Promise<any> {
  /* tslint:enable:no-any */
    return new Promise<void>((resolve: () => void, reject: () => void) => {
      testArray.push(this.name);
      resolve();
    });
  }
}

class StreamTask extends GulpTask<IConfig> {
  public name: string = 'stream';

  public taskConfig: IConfig = {
  };

  /* tslint:disable:no-any */
  public executeTask(gulp: typeof Gulp): any {
    /* tslint:enable:no-any */
    const stream: Readable = new Readable({ objectMode: true });

    // Add no opt function to make it compat with through
    stream['_read'] = () => { // tslint:disable-line:no-string-literal
      // Do Nothing
    };

    setTimeout(() => {

      const file: gutil.File = new gutil.File({
        path: 'test.js',
        contents: new Buffer('test')
      });

      stream.push(file);

      testArray.push(this.name);

      stream.emit('end');
    }, 100);

    return stream;
  }
}

class SyncTask extends GulpTask<IConfig> {
  public name: string = 'sync';

  public taskConfig: IConfig = {
  };

  public executeTask(gulp: typeof Gulp): void {
    testArray.push(this.name);
  }
}

class SyncWithReturnTask extends GulpTask<IConfig> {
  public name: string = 'sync-with-return';

  public taskConfig: IConfig = {
  };

  public executeTask(gulp: typeof Gulp): void {
    testArray.push(this.name);
  }
}

class CallbackTask extends GulpTask<IConfig> {
  public name: string = 'callback';

  public taskConfig: IConfig = {
  };

  public executeTask(gulp: typeof Gulp, callback: (error?: string | Error) => void): void {
    testArray.push(this.name);
    callback();
  }
}

interface ISimpleConfig {
  shouldDoThings: boolean;
}

class SchemaTask extends GulpTask<ISimpleConfig> {
  public name: string = 'schema-task';

  public taskConfig: ISimpleConfig = {
    shouldDoThings: false
  };

  public executeTask(gulp: typeof Gulp, callback: (error?: string | Error) => void): void {
    callback();
  }

  protected _getConfigFilePath(): string {
    return path.join(__dirname, 'schema-task.config.json');
  }
}

const tasks: GulpTask<IConfig>[] = [
];

tasks.push(new PromiseTask());
tasks.push(new StreamTask());
tasks.push(new SyncTask());
tasks.push(new SyncWithReturnTask());
tasks.push(new CallbackTask());

describe('GulpTask', () => {
  for (const task of tasks) {
    it(`${task.name} serial`, (done) => {
      testArray = [];
      task.setConfig({ addToMe: testArray });
      serial(task).execute(mockBuildConfig).then(() => {
        expect(testArray).to.deep.equal([task.name]);
        done();
      }).catch(done);
    });

    it(`${task.name} parallel`, (done) => {
      testArray = [];
      task.setConfig({ addToMe: testArray });
      parallel(task).execute(mockBuildConfig).then(() => {
        expect(testArray).to.deep.equal([task.name]);
        done();
      }).catch(done);
    });
  }

  it(`all tasks serial`, (done) => {
    testArray = [];
    for (const task of tasks) {
      task.setConfig({ addToMe: testArray });
    }
    serial(tasks).execute(mockBuildConfig).then(() => {
      for (const task of tasks) {
        expect(testArray.indexOf(task.name)).to.be.greaterThan(-1);
      }
      done();
    }).catch(done);
  });

  it(`all tasks parallel`, (done) => {
    testArray = [];
    for (const task of tasks) {
      task.setConfig({ addToMe: testArray });
    }
    parallel(tasks).execute(mockBuildConfig).then(() => {
      for (const task of tasks) {
        expect(testArray.indexOf(task.name)).to.be.greaterThan(-1);
      }
      done();
    }).catch(done);
  });

  it(`reads schema file if loadSchema is implemented`, (done) => {
    const schemaTask: SchemaTask = new SchemaTask();
    assert.isFalse(schemaTask.taskConfig.shouldDoThings);
    schemaTask.onRegister();
    assert.isTrue(schemaTask.taskConfig.shouldDoThings);
    done();
  });

  it(`throws validation error is config does not conform to schema file`, (done) => {
    const schemaTask: SchemaTask = new SchemaTask();

    // tslint:disable-next-line:no-any
    (schemaTask as any)._getConfigFilePath = (): string => {
      return path.join(__dirname, 'other-schema-task.config.json');
    };

    assert.isFalse(schemaTask.taskConfig.shouldDoThings);
    assert.throws(schemaTask.onRegister);
    done();
  });
});
