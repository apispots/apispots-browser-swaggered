/**
 * Story player service.
 *
 * @author Chris Spiliotopoulos
 */
import _ from 'lodash';
import asyncEachSeries from 'async/eachSeries';
import asyncWaterfall from 'async/waterfall';
// import axios from 'axios';

import ApiDefinition from '../openapi/api-definition';

export default (function() {

  /**
   * Plays a story.
   * @param  {[type]} story [description]
   * @return {[type]}       [description]
   */
  const _play = function(story) {

    return new Promise((resolve, reject) => {
      try {

        // if story is empty throw an error
        if (_.isEmpty(story)) {
          throw new Error('Invalid story instance');
        }

        if (_.isEmpty(story.spec)) {
          throw new Error('Invalid Open API spec');
        }

        // pipeline tasks
        asyncWaterfall([

          (cb) => {

            // load the Open API definition
            // used by the story
            ApiDefinition.load({
              url: story.spec
            })
              .then(api => {
                cb(null, api);
              });
          },

          (api, cb) => {

            // map the story part to the API definition
            _.each(story.parts, (part) => {
              try {
                _validatePart(part, api);
              } catch (e) {
                // mark the part as invalid
                part.valid = false;
              }
            });

            cb(null, api);
          },

          (api, cb) => {

            // keep only the valid story parts
            const valid = _.filter(story.parts, {
              valid: true
            });

            // go through all valid parts
            asyncEachSeries(valid, (part, done) => {
              try {

                // play each part in turn
                _playPart(part, api)
                  .then((res) => {

                    // update the story with
                    // the output
                    const output = {
                      ok: res.ok,
                      status: res.status,
                      statusText: res.statusText,
                      headers: res.headers,
                      data: res.obj,
                      text: res.text
                    };

                    // set the part's output section
                    part.output = output;

                    // part played
                    done();
                  })
                  .catch(e => {

                    const output = {
                      ok: false,
                      statusText: e.message
                    };

                    // set the part's output section
                    part.output = output;
                    done();
                  });

              } catch (e) {
                console.error(e);
              }
            }, (err) => {

              // all parts have been played
              cb(err);
            });
          }

        ], (e) => {

          if (e) {
            reject(e);
          } else {
            resolve();
          }
        });


      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * Given an API definition and a story
   * part, it locates the operation by Id
   * and validates it according to the
   * spec and input data set.
   * @param  {[type]} story [description]
   * @param  {[type]} api   [description]
   * @return {[type]}       [description]
   */
  const _validatePart = function(part, api) {

    // get the operation definition by Id
    const operation = api.getOperation(part.operationId);

    if (_.isEmpty(operation)) {
      throw new Error(`Undefined operation ${part.operationId}`);
    }


    // mark part as valid
    part.valid = true;

  };


  /**
   * Plays a story part.
   * @param  {[type]} part [description]
   * @return {[type]}      [description]
   */
  const _playPart = function(part, api) {

    return new Promise((resolve, reject) => {

      // execute the API operation
      // using the client interface
      api.client.execute({
        operationId: part.operationId,
        parameters: part.input.parameters
      })
        .then((res) => {
          resolve(res);
        })
        .catch(reject);

    });

  };

  return {

    /*
     * Public
     */
    play: _play
  };

}());
