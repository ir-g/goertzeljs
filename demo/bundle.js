require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

var Utilities = {
  floatToIntSample: function floatToIntSample(floatSample) {
    var intSample = floatSample * 32768 + 0.5 | 0;
    if (intSample > 32767) {
      return 32767;
    } else if (intSample < -32768) {
      return -32768;
    }
    return intSample;
  },
  downsampleBuffer: function downsampleBuffer(buffer, downsampleRate, mapSample) {
    var bufferLength = buffer.length,
        downsampledBuffer = new Uint8ClampedArray(bufferLength / downsampleRate),
        i = 0;
    while (i < bufferLength) {
      var sample = buffer[i];
      if (mapSample) {
        downsampledBuffer[i] = mapSample(sample, i, buffer.length, downsampleRate);
      } else {
        downsampledBuffer[i] = sample;
      }
      i += downsampleRate;
    }
    return downsampledBuffer;
  },
  eachDownsample: function eachDownsample(buffer, downSampleRate, fn) {
    var i = 0,
        bufferLength = buffer.length,
        downSampledBufferLength = bufferLength / downSampleRate,
        result = [];
    while (i < bufferLength) {
      var sample = buffer[i];
      if (fn) fn(sample, i, downSampledBufferLength);
      result.push(i += downSampleRate);
    }
    return result;
  },
  hamming: function hamming(sample, sampleIndex, bufferSize) {
    return sample * (0.54 - 0.46 * Math.cos(2 * Math.PI * sampleIndex / bufferSize));
  },
  exactBlackman: function exactBlackman(sample, sampleIndex, bufferSize) {
    return sample * (0.426591 - 0.496561 * Math.cos(2 * Math.PI * sampleIndex / bufferSize) + 0.076848 * Math.cos(4 * Math.PI * sampleIndex / bufferSize));
  },
  peakFilter: function peakFilter(energies, sensitivity) {
    energies = energies.sort().reverse();
    var peak = energies[0],
        secondPeak = energies[1],
        thirdPeak = energies[2],
        trough = energies.reverse()[0];
    return secondPeak > peak / sensitivity || thirdPeak > secondPeak / (sensitivity / 2) || trough > peak / (sensitivity / 2);
  },
  doublePeakFilter: function doublePeakFilter(energies1, energies2, sensitivity) {
    return this.peakFilter(energies1, sensitivity) || this.peakFilter(energies2, sensitivity);
  },


  // useful for testing purposes

  generateSineBuffer: function generateSineBuffer(frequencies, sampleRate, numberOfSamples) {
    var phase = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

    var buffer = new Float32Array(numberOfSamples),
        volumePerSine = 1 / frequencies.length,
        i = 0;
    while (i < numberOfSamples) {
      var val = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Array.from(frequencies)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var frequency = _step.value;

          val += Math.sin(Math.PI * 2 * ((i + phase) / sampleRate) * frequency) * volumePerSine;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      buffer[i] = val;
      i++;
    }
    return buffer;
  },
  generateWhiteNoiseBuffer: function generateWhiteNoiseBuffer(sampleRate, numberOfSamples) {
    var buffer = new Float32Array(numberOfSamples),
        i = 0;
    while (i < numberOfSamples) {
      buffer[i] = Math.random() * 2 - 1;
      i++;
    }
    return buffer;
  },
  floatBufferToInt: function floatBufferToInt(floatBuffer) {
    var floatBufferLength = floatBuffer.length,
        intBuffer = new Uint8ClampedArray(floatBufferLength),
        i = 0;
    while (i < floatBufferLength) {
      intBuffer[i] = Utilities.floatToIntSample(floatBuffer[i]);
      i++;
    }
    return intBuffer;
  },
  averageDecibels: function averageDecibels(buffer) {
    // always returns a positive number, even
    // if a buffer contains negative samples
    var sum = 0,
        bufferLength = buffer.length,
        i = 0;
    while (i < bufferLength) {
      sum += Math.abs(buffer[i]);
      i++;
    }
    return sum / bufferLength;
  }
};

module.exports = Utilities;

},{}],"dtmf":[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Goertzel = require('../index');

var DTMF = function () {
  function DTMF(options) {
    var _, _2, _3, _4, _frequencyTable;

    _classCallCheck(this, DTMF);

    if (options == null) {
      options = {};
    }
    this.options = {
      downsampleRate: 1,
      energyThreshold: 0,
      decibelThreshold: 0,
      repeatMin: 0,
      sampleRate: 44100
    };
    for (var option in options) {
      this.options[option] = options[option];
    }
    this.sampleRate = this.options.sampleRate / this.options.downsampleRate;
    this.frequencyTable = (_frequencyTable = {}, _defineProperty(_frequencyTable, 697, (_ = {}, _defineProperty(_, 1209, '1'), _defineProperty(_, 1336, '2'), _defineProperty(_, 1477, '3'), _defineProperty(_, 1633, 'A'), _)), _defineProperty(_frequencyTable, 770, (_2 = {}, _defineProperty(_2, 1209, '4'), _defineProperty(_2, 1336, '5'), _defineProperty(_2, 1477, '6'), _defineProperty(_2, 1633, 'B'), _2)), _defineProperty(_frequencyTable, 852, (_3 = {}, _defineProperty(_3, 1209, '7'), _defineProperty(_3, 1336, '8'), _defineProperty(_3, 1477, '9'), _defineProperty(_3, 1633, 'C'), _3)), _defineProperty(_frequencyTable, 941, (_4 = {}, _defineProperty(_4, 1209, '*'), _defineProperty(_4, 1336, '0'), _defineProperty(_4, 1477, '#'), _defineProperty(_4, 1633, 'D'), _4)), _frequencyTable);
    this.lowFrequencies = [];
    for (var key in this.frequencyTable) {
      this.lowFrequencies.push(parseInt(key));
    }
    this.highFrequencies = [];
    for (key in this.frequencyTable[this.lowFrequencies[0]]) {
      this.highFrequencies.push(parseInt(key));
    }
    this.allFrequencies = this.lowFrequencies.concat(this.highFrequencies);
    this.repeatCounter = 0;
    this.firstPreviousValue = '';
    this.goertzel = new Goertzel({
      frequencies: this.allFrequencies,
      sampleRate: this.sampleRate
    });
    this.decodeHandlers = [];
    this.jobs = { beforeProcess: [] };
  }

  _createClass(DTMF, [{
    key: 'processBuffer',
    value: function processBuffer(buffer) {
      var _this = this;

      var value = '';
      var result = [];
      this._runJobs('beforeProcess', buffer);
      if (this.options.decibelThreshold && Goertzel.Utilities.averageDecibels(buffer) < this.options.decibelThreshold) {
        return result;
      }
      // Downsample by choosing every Nth sample.
      Goertzel.Utilities.eachDownsample(buffer, this.options.downsampleRate, function (sample, i, downSampledBufferLength) {
        var windowedSample = Goertzel.Utilities.exactBlackman(sample, i, downSampledBufferLength);
        _this.goertzel.processSample(windowedSample);
      });
      var energies = {
        high: [],
        low: []
      };
      var _arr = ['high', 'low'];
      for (var _i = 0; _i < _arr.length; _i++) {
        var fType = _arr[_i];
        var i = 0;
        while (i < this[fType + 'Frequencies'].length) {
          var f = this[fType + 'Frequencies'][i];
          energies[fType].push(this.goertzel.energies[f]);
          i++;
        }
      }
      if (this.options.filter && this.options.filter({ goertzel: this.goertzel, energies: energies }) || !this.options.filter) {
        value = this._energyProfileToCharacter(this.goertzel);
        if ((value === this.firstPreviousValue || this.options.repeatMin === 0) && value !== undefined) {
          if (this.options.repeatMin !== 0) {
            this.repeatCounter += 1;
          }
          if (this.repeatCounter === this.options.repeatMin) {
            result.push(value);
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = Array.from(this.decodeHandlers)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var handler = _step.value;

                setTimeout(handler(value), 0);
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          }
        } else {
          this.repeatCounter = 0;
          this.firstPreviousValue = value;
        }
      }
      this.goertzel.refresh();
      return result;
    }
  }, {
    key: 'on',
    value: function on(eventName, handler) {
      switch (eventName) {
        case "decode":
          return this.decodeHandlers.push(handler);
      }
    }
  }, {
    key: 'calibrate',
    value: function calibrate(multiplier) {
      if (multiplier == null) {
        multiplier = 1;
      }
      if (!this.jobs.beforeProcess) {
        this.jobs.beforeProcess = [];
      }
      return this.jobs.beforeProcess.push(function (buffer, dtmf) {
        return dtmf.options.decibelThreshold = Goertzel.Utilities.averageDecibels(buffer) * multiplier;
      });
    }

    // private

  }, {
    key: '_energyProfileToCharacter',
    value: function _energyProfileToCharacter(register) {
      var energies = register.energies;
      // Find high frequency.

      var highFrequency = 0.0;
      var highFrequencyEngergy = 0.0;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = Array.from(this.highFrequencies)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var f = _step2.value;

          if (energies[f] > highFrequencyEngergy && energies[f] > this.options.energyThreshold) {
            highFrequencyEngergy = energies[f];
            highFrequency = f;
          }
        }
        // Find low frequency.
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      var lowFrequency = 0.0;
      var lowFrequencyEnergy = 0.0;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = Array.from(this.lowFrequencies)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          f = _step3.value;

          if (energies[f] > lowFrequencyEnergy && energies[f] > this.options.energyThreshold) {
            lowFrequencyEnergy = energies[f];
            lowFrequency = f;
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return this.frequencyTable[lowFrequency] ? this.frequencyTable[lowFrequency][highFrequency] : null;
    }
  }, {
    key: '_runJobs',
    value: function _runJobs(jobName, buffer) {
      var _this2 = this;

      if (this.jobs[jobName]) {
        var queueLength = this.jobs[jobName].length;
        var i = 0;
        return function () {
          var result = [];
          while (i < queueLength) {
            _this2.jobs[jobName].pop()(buffer, _this2);
            result.push(i++);
          }
          return result;
        }();
      }
    }
  }]);

  return DTMF;
}();

module.exports = DTMF;

},{"../index":"goertzeljs"}],"goertzeljs":[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GOERTZEL_ATTRIBUTES = ['firstPrevious', 'secondPrevious', 'totalPower', 'filterLength', 'energies', 'phases'],
    GOERTZEL_ATTRIBUTES_LENGTH = GOERTZEL_ATTRIBUTES.length,
    atan2 = Math.atan2,
    cos = Math.cos,
    sin = Math.sin,
    PI = Math.PI;
/**
 * A pure JavaScript implementation of the Goertzel algorithm, a means of efficient DFT signal processing.
 * @param {object}        options
 * @param {array}         options.frequencies - The frequencies to be processed.
 * @param {number=44100}  options.sampleRate  - The sample rate of the samples to be processed.  Defaults to 44100.
 * @param {boolean=false} options.getPhase    - Calculates the current phase angle of each frequency.  Disabled by default.
 */

var Goertzel = function () {
  function Goertzel() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Goertzel);

    this.options = options;
    this.sampleRate = options.sampleRate || 44100;
    this.frequencies = options.frequencies || [];
    this._initializeConstants(this.frequencies);
    this.refresh();
  }
  /**
   * Runs a sample through the Goertzel algorithm, updating the energies for each frequency.
   * @param {number} sample 
   * @example
   * const g = new Goertzel({frequencies: [697, 770, 852, 941]});
   * g.processSample(42);
   * g.processSample(84);
   * g.energies;
   * // { '697': 0.8980292970055112,
   * //   '770': 0.8975953139667142,
   * //   '852': 0.8970565383230514,
   * //   '941': 0.8964104403348228 }
   */


  _createClass(Goertzel, [{
    key: 'processSample',
    value: function processSample(sample) {
      this.currentSample = sample;
      var len = this.frequencies.length;
      var i = 0;
      while (i < len) {
        var frequency = this.frequencies[i];
        this._getEnergyOfFrequency(sample, frequency);
        i++;
      }
    }
    /**
     * Re-initializes the state by zeroing-out all values.  You will need to do this for every window you wish to analyze.
     */

  }, {
    key: 'refresh',
    value: function refresh() {
      var _this = this;

      var i = 0;
      while (i < GOERTZEL_ATTRIBUTES_LENGTH) {
        var attr = GOERTZEL_ATTRIBUTES[i];
        this[attr] = {};
        i++;
      }
      this.frequencies.forEach(function (frequency) {
        var i = 0;
        while (i < GOERTZEL_ATTRIBUTES_LENGTH) {
          var _attr = GOERTZEL_ATTRIBUTES[i];
          _this[_attr][frequency] = 0.0;
          i++;
        }
      });
    }
  }, {
    key: '_getEnergyOfFrequency',
    value: function _getEnergyOfFrequency(sample, frequency) {
      var f1 = this.firstPrevious[frequency],
          f2 = this.secondPrevious[frequency];
      var coefficient = this.coefficient[frequency],
          sine = sample + coefficient * f1 - f2;
      f2 = f1;
      f1 = sine;
      this.filterLength[frequency] += 1;
      var power = f2 * f2 + f1 * f1 - coefficient * f1 * f2,
          totalPower = this.totalPower[frequency] += sample * sample;
      if (totalPower === 0) this.totalPower[frequency] = 1;
      this.energies[frequency] = power / totalPower / this.filterLength[frequency];
      if (this.options.getPhase) {
        var real = f1 - f2 * this.cosine[frequency],
            imaginary = f2 * this.sine[frequency];
        this.phases[frequency] = atan2(imaginary, real);
      }
      this.firstPrevious[frequency] = f1;
      this.secondPrevious[frequency] = f2;
    }
  }, {
    key: '_initializeConstants',
    value: function _initializeConstants(frequencies) {
      var len = frequencies.length;
      var frequency = void 0,
          normalizedFrequency = void 0,
          omega = void 0,
          cosine = void 0,
          i = 0;
      this.sine = {}, this.cosine = {}, this.coefficient = {};
      while (i < len) {
        frequency = frequencies[i];
        normalizedFrequency = frequency / this.sampleRate;
        omega = 2.0 * PI * normalizedFrequency;
        cosine = cos(omega);
        this.sine[frequency] = sin(omega);
        this.cosine[frequency] = cosine;
        this.coefficient[frequency] = 2.0 * cosine;
        i++;
      }
    }
  }]);

  return Goertzel;
}();

Goertzel.Utilities = require('./lib/util');

module.exports = Goertzel;

},{"./lib/util":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvdXRpbC5qcyIsImxpYi9kdG1mLmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxJQUFNLFlBQVk7QUFDaEIsa0JBRGdCLDRCQUNDLFdBREQsRUFDYztBQUM1QixRQUFNLFlBQWMsY0FBYyxLQUFmLEdBQXdCLEdBQXpCLEdBQWdDLENBQWxEO0FBQ0EsUUFBSSxZQUFZLEtBQWhCLEVBQXVCO0FBQ3JCLGFBQU8sS0FBUDtBQUNELEtBRkQsTUFFTyxJQUFJLFlBQVksQ0FBQyxLQUFqQixFQUF3QjtBQUM3QixhQUFPLENBQUMsS0FBUjtBQUNEO0FBQ0QsV0FBTyxTQUFQO0FBQ0QsR0FUZTtBQVdoQixrQkFYZ0IsNEJBV0MsTUFYRCxFQVdTLGNBWFQsRUFXeUIsU0FYekIsRUFXb0M7QUFDbEQsUUFBSSxlQUFvQixPQUFPLE1BQS9CO0FBQUEsUUFDSSxvQkFBb0IsSUFBSSxpQkFBSixDQUFzQixlQUFlLGNBQXJDLENBRHhCO0FBQUEsUUFFSSxJQUFJLENBRlI7QUFHQSxXQUFPLElBQUksWUFBWCxFQUF5QjtBQUN2QixVQUFJLFNBQVMsT0FBTyxDQUFQLENBQWI7QUFDQSxVQUFJLFNBQUosRUFBZTtBQUNiLDBCQUFrQixDQUFsQixJQUF1QixVQUFVLE1BQVYsRUFBa0IsQ0FBbEIsRUFBcUIsT0FBTyxNQUE1QixFQUFvQyxjQUFwQyxDQUF2QjtBQUNELE9BRkQsTUFFTztBQUNMLDBCQUFrQixDQUFsQixJQUF1QixNQUF2QjtBQUNEO0FBQ0QsV0FBSyxjQUFMO0FBQ0Q7QUFDRCxXQUFPLGlCQUFQO0FBQ0QsR0F6QmU7QUEyQmhCLGdCQTNCZ0IsMEJBMkJELE1BM0JDLEVBMkJPLGNBM0JQLEVBMkJ1QixFQTNCdkIsRUEyQjJCO0FBQ3pDLFFBQUksSUFBSSxDQUFSO0FBQUEsUUFDSSxlQUEwQixPQUFPLE1BRHJDO0FBQUEsUUFFSSwwQkFBMEIs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R0ksZUFISjtBQUFBLFVBSUksSUFBSSxDQUpSO0FBS0EsV0FBSyxJQUFMLEdBQW1CLEVBQW5CLEVBQ0EsS0FBSyxNQUFMLEdBQW1CLEVBRG5CLEVBRUEsS0FBSyxXQUFMLEdBQW1CLEVBRm5CO0FBR0EsYUFBTSxJQUFFLEdBQVIsRUFBWTtBQUNWLG9CQUFZLFlBQVksQ0FBWixDQUFaO0FBQ0EsOEJBQXNCLFlBQVksS0FBSyxVQUF2QztBQUNBLGdCQUFTLE1BQU0sRUFBTixHQUFXLG1CQUFwQjtBQUNBLGlCQUFTLElBQUksS0FBSixDQUFUO0FBQ0EsYUFBSyxJQUFMLENBQVUsU0FBVixJQUE4QixJQUFJLEtBQUosQ0FBOUI7QUFDQSxhQUFLLE1BQUwsQ0FBWSxTQUFaLElBQThCLE1BQTlCO0FBQ0EsYUFBSyxXQUFMLENBQWlCLFNBQWpCLElBQThCLE1BQU0sTUFBcEM7QUFDQTtBQUNEO0FBQ0Y7Ozs7OztBQUdILFNBQVMsU0FBVCxHQUFxQixRQUFRLFlBQVIsQ0FBckI7O0FBRUEsT0FBTyxPQUFQLEdBQWlCLFFBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBVdGlsaXRpZXMgPSB7XG4gIGZsb2F0VG9JbnRTYW1wbGUoZmxvYXRTYW1wbGUpIHtcbiAgICBjb25zdCBpbnRTYW1wbGUgPSAoKGZsb2F0U2FtcGxlICogMzI3NjgpICsgMC41KSB8IDA7XG4gICAgaWYgKGludFNhbXBsZSA+IDMyNzY3KSB7XG4gICAgICByZXR1cm4gMzI3Njc7XG4gICAgfSBlbHNlIGlmIChpbnRTYW1wbGUgPCAtMzI3NjgpIHtcbiAgICAgIHJldHVybiAtMzI3Njg7XG4gICAgfVxuICAgIHJldHVybiBpbnRTYW1wbGU7XG4gIH0sXG5cbiAgZG93bnNhbXBsZUJ1ZmZlcihidWZmZXIsIGRvd25zYW1wbGVSYXRlLCBtYXBTYW1wbGUpIHtcbiAgICBsZXQgYnVmZmVyTGVuZ3RoICAgICAgPSBidWZmZXIubGVuZ3RoLFxuICAgICAgICBkb3duc2FtcGxlZEJ1ZmZlciA9IG5ldyBVaW50OENsYW1wZWRBcnJheShidWZmZXJMZW5ndGggLyBkb3duc2FtcGxlUmF0ZSksXG4gICAgICAgIGkgPSAwO1xuICAgIHdoaWxlIChpIDwgYnVmZmVyTGVuZ3RoKSB7XG4gICAgICBsZXQgc2FtcGxlID0gYnVmZmVyW2ldO1xuICAgICAgaWYgKG1hcFNhbXBsZSkge1xuICAgICAgICBkb3duc2FtcGxlZEJ1ZmZlcltpXSA9IG1hcFNhbXBsZShzYW1wbGUsIGksIGJ1ZmZlci5sZW5ndGgsIGRvd25zYW1wbGVSYXRlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRvd25zYW1wbGVkQnVmZmVyW2ldID0gc2FtcGxlO1xuICAgICAgfVxuICAgICAgaSArPSBkb3duc2FtcGxlUmF0ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRvd25zYW1wbGVkQnVmZmVyO1xuICB9LFxuXG4gIGVhY2hEb3duc2FtcGxlKGJ1ZmZlciwgZG93blNhbXBsZVJhdGUsIGZuKSB7XG4gICAgbGV0IGkgPSAwLFxuICAgICAgICBidWZmZXJMZW5ndGggICAgICAgICAgICA9IGJ1ZmZlci5sZW5ndGgsXG4gICAgICAgIGRvd25TYW1wbGVkQnVmZmVyTGVuZ3RoID0gYnVmZmVyTGVuZ3RoIC8gZG93blNhbXBsZVJhdGUsXG4gICAgICAgIHJlc3VsdCAgICAgICAgICAgICAgICAgID0gW107XG4gICAgd2hpbGUgKGkgPCBidWZmZXJMZW5ndGgpIHtcbiAgICAgIHZhciBzYW1wbGUgPSBidWZmZXJbaV07XG4gICAgICBpZihmbikgZm4oc2FtcGxlLCBpLCBkb3duU2FtcGxlZEJ1ZmZlckxlbmd0aCk7XG4gICAgICByZXN1bHQucHVzaChpICs9IGRvd25TYW1wbGVSYXRlKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICBoYW1taW5nKHNhbXBsZSwgc2FtcGxlSW5kZXgsIGJ1ZmZlclNpemUpIHtcbiAgICByZXR1cm4gc2FtcGxlICogKDAuNTQgLSAoMC40NiAqIE1hdGguY29zKCgyICogTWF0aC5QSSAqIHNhbXBsZUluZGV4KSAvIGJ1ZmZlclNpemUpKSk7XG4gIH0sXG5cbiAgZXhhY3RCbGFja21hbihzYW1wbGUsIHNhbXBsZUluZGV4LCBidWZmZXJTaXplKSB7XG4gICAgcmV0dXJuIHNhbXBsZSAqICgoMC40MjY1OTEgLSAoMC40OTY1NjEgKiBNYXRoLmNvcygoMiAqIE1hdGguUEkgKiBzYW1wbGVJbmRleCkvYnVmZmVyU2l6ZSkpKSArICgwLjA3Njg0OCAqIE1hdGguY29zKCg0ICogTWF0aC5QSSAqIHNhbXBsZUluZGV4KS9idWZmZXJTaXplKSkpO1xuICB9LFxuXG4gIHBlYWtGaWx0ZXIoZW5lcmdpZXMsIHNlbnNpdGl2aXR5KSB7XG4gICAgZW5lcmdpZXMgPSBlbmVyZ2llcy5zb3J0KCkucmV2ZXJzZSgpO1xuICAgIGxldCBwZWFrICAgICAgID0gZW5lcmdpZXNbMF0sXG4gICAgICAgIHNlY29uZFBlYWsgPSBlbmVyZ2llc1sxXSxcbiAgICAgICAgdGhpcmRQZWFrICA9IGVuZXJnaWVzWzJdLFxuICAgICAgICB0cm91Z2ggICAgID0gZW5lcmdpZXMucmV2ZXJzZSgpWzBdO1xuICAgIHJldHVybiAoc2Vjb25kUGVhayA+IChwZWFrIC8gc2Vuc2l0aXZpdHkpKSB8fFxuICAgICAgICAgICAodGhpcmRQZWFrID4gKHNlY29uZFBlYWsgLyAoc2Vuc2l0aXZpdHkgLyAyKSkpIHx8XG4gICAgICAgICAgICh0cm91Z2ggPiAocGVhayAvIChzZW5zaXRpdml0eSAvIDIpKSk7XG4gIH0sXG5cbiAgZG91YmxlUGVha0ZpbHRlcihlbmVyZ2llczEsIGVuZXJnaWVzMiwgc2Vuc2l0aXZpdHkpIHtcbiAgICByZXR1cm4gdGhpcy5wZWFrRmlsdGVyKGVuZXJnaWVzMSwgc2Vuc2l0aXZpdHkpIHx8IHRoaXMucGVha0ZpbHRlcihlbmVyZ2llczIsIHNlbnNpdGl2aXR5KTtcbiAgfSxcblxuICAvLyB1c2VmdWwgZm9yIHRlc3RpbmcgcHVycG9zZXNcblxuICBnZW5lcmF0ZVNpbmVCdWZmZXIoZnJlcXVlbmNpZXMsIHNhbXBsZVJhdGUsIG51bWJlck9mU2FtcGxlcywgcGhhc2U9MCkge1xuICAgIGxldCBidWZmZXIgICAgICAgID0gbmV3IEZsb2F0MzJBcnJheShudW1iZXJPZlNhbXBsZXMpLFxuICAgICAgICB2b2x1bWVQZXJTaW5lID0gMSAvIGZyZXF1ZW5jaWVzLmxlbmd0aCxcbiAgICAgICAgaSAgICAgICAgICAgICA9IDA7XG4gICAgd2hpbGUgKGkgPCBudW1iZXJPZlNhbXBsZXMpIHtcbiAgICAgIGxldCB2YWwgPSAwO1xuICAgICAgZm9yIChsZXQgZnJlcXVlbmN5IG9mIEFycmF5LmZyb20oZnJlcXVlbmNpZXMpKSB7XG4gICAgICAgIHZhbCArPSAoTWF0aC5zaW4oTWF0aC5QSSAqIDIgKiAoKGkgKyBwaGFzZSkgLyBzYW1wbGVSYXRlKSAqIGZyZXF1ZW5jeSkgKiB2b2x1bWVQZXJTaW5lKTtcbiAgICAgIH1cbiAgICAgIGJ1ZmZlcltpXSA9IHZhbDtcbiAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSxcblxuICBnZW5lcmF0ZVdoaXRlTm9pc2VCdWZmZXIoc2FtcGxlUmF0ZSwgbnVtYmVyT2ZTYW1wbGVzKSB7XG4gICAgbGV0IGJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkobnVtYmVyT2ZTYW1wbGVzKSxcbiAgICAgICAgaSAgICAgID0gMDtcbiAgICB3aGlsZSAoaSA8IG51bWJlck9mU2FtcGxlcykge1xuICAgICAgYnVmZmVyW2ldID0gKE1hdGgucmFuZG9tKCkgKiAyKSAtIDE7XG4gICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH0sXG5cbiAgZmxvYXRCdWZmZXJUb0ludChmbG9hdEJ1ZmZlcikge1xuICAgIGxldCBmbG9hdEJ1ZmZlckxlbmd0aCA9IGZsb2F0QnVmZmVyLmxlbmd0aCxcbiAgICAgICAgaW50QnVmZmVyICAgICAgICAgPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoZmxvYXRCdWZmZXJMZW5ndGgpLFxuICAgICAgICBpICAgICAgICAgICAgICAgICA9IDA7XG4gICAgd2hpbGUgKGkgPCBmbG9hdEJ1ZmZlckxlbmd0aCkge1xuICAgICAgaW50QnVmZmVyW2ldID0gVXRpbGl0aWVzLmZsb2F0VG9JbnRTYW1wbGUoZmxvYXRCdWZmZXJbaV0pO1xuICAgICAgaSsrO1xuICAgIH1cbiAgICByZXR1cm4gaW50QnVmZmVyO1xuICB9LFxuXG4gIGF2ZXJhZ2VEZWNpYmVscyhidWZmZXIpIHtcbiAgICAvLyBhbHdheXMgcmV0dXJucyBhIHBvc2l0aXZlIG51bWJlciwgZXZlblxuICAgIC8vIGlmIGEgYnVmZmVyIGNvbnRhaW5zIG5lZ2F0aXZlIHNhbXBsZXNcbiAgICBsZXQgc3VtICAgICAgICAgID0gMCxcbiAgICAgICAgYnVmZmVyTGVuZ3RoID0gYnVmZmVyLmxlbmd0aCxcbiAgICAgICAgaSAgICAgICAgICAgID0gMDtcbiAgICB3aGlsZSAoaSA8IGJ1ZmZlckxlbmd0aCkge1xuICAgICAgc3VtICs9IE1hdGguYWJzKGJ1ZmZlcltpXSk7XG4gICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBzdW0gLyBidWZmZXJMZW5ndGg7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXRpbGl0aWVzO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IEdvZXJ0emVsID0gcmVxdWlyZSgnLi4vaW5kZXgnKTtcblxuY2xhc3MgRFRNRiB7IFxuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT0gbnVsbCkgeyBvcHRpb25zID0ge307IH1cbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICBkb3duc2FtcGxlUmF0ZTogICAxLFxuICAgICAgZW5lcmd5VGhyZXNob2xkOiAgMCxcbiAgICAgIGRlY2liZWxUaHJlc2hvbGQ6IDAsXG4gICAgICByZXBlYXRNaW46ICAgICAgICAwLFxuICAgICAgc2FtcGxlUmF0ZTogICAgICAgNDQxMDBcbiAgICB9O1xuICAgIGZvciAobGV0IG9wdGlvbiBpbiBvcHRpb25zKSB7XG4gICAgICB0aGlzLm9wdGlvbnNbb3B0aW9uXSA9IG9wdGlvbnNbb3B0aW9uXTtcbiAgICB9XG4gICAgdGhpcy5zYW1wbGVSYXRlID0gdGhpcy5vcHRpb25zLnNhbXBsZVJhdGUgLyB0aGlzLm9wdGlvbnMuZG93bnNhbXBsZVJhdGU7XG4gICAgdGhpcy5mcmVxdWVuY3lUYWJsZSA9IHtcbiAgICAgIFs2OTddOiB7XG4gICAgICAgIFsxMjA5XTogJzEnLFxuICAgICAgICBbMTMzNl06ICcyJyxcbiAgICAgICAgWzE0NzddOiAnMycsXG4gICAgICAgIFsxNjMzXTogJ0EnXG4gICAgICB9LFxuICAgICAgWzc3MF06IHtcbiAgICAgICAgWzEyMDldOiAnNCcsXG4gICAgICAgIFsxMzM2XTogJzUnLFxuICAgICAgICBbMTQ3N106ICc2JyxcbiAgICAgICAgWzE2MzNdOiAnQidcbiAgICAgIH0sXG4gICAgICBbODUyXToge1xuICAgICAgICBbMTIwOV06ICc3JyxcbiAgICAgICAgWzEzMzZdOiAnOCcsXG4gICAgICAgIFsxNDc3XTogJzknLFxuICAgICAgICBbMTYzM106ICdDJ1xuICAgICAgfSxcbiAgICAgIFs5NDFdOiB7XG4gICAgICAgIFsxMjA5XTogJyonLFxuICAgICAgICBbMTMzNl06ICcwJyxcbiAgICAgICAgWzE0NzddOiAnIycsXG4gICAgICAgIFsxNjMzXTogJ0QnXG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLmxvd0ZyZXF1ZW5jaWVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMuZnJlcXVlbmN5VGFibGUpIHtcbiAgICAgIHRoaXMubG93RnJlcXVlbmNpZXMucHVzaChwYXJzZUludChrZXkpKTtcbiAgICB9XG4gICAgdGhpcy5oaWdoRnJlcXVlbmNpZXMgPSBbXTtcbiAgICBmb3IgKGtleSBpbiB0aGlzLmZyZXF1ZW5jeVRhYmxlW3RoaXMubG93RnJlcXVlbmNpZXNbMF1dKSB7XG4gICAgICB0aGlzLmhpZ2hGcmVxdWVuY2llcy5wdXNoKHBhcnNlSW50KGtleSkpO1xuICAgIH1cbiAgICB0aGlzLmFsbEZyZXF1ZW5jaWVzID0gdGhpcy5sb3dGcmVxdWVuY2llcy5jb25jYXQodGhpcy5oaWdoRnJlcXVlbmNpZXMpO1xuICAgIHRoaXMucmVwZWF0Q291bnRlciA9IDA7XG4gICAgdGhpcy5maXJzdFByZXZpb3VzVmFsdWUgPSAnJztcbiAgICB0aGlzLmdvZXJ0emVsID0gbmV3IEdvZXJ0emVsKHtcbiAgICAgIGZyZXF1ZW5jaWVzOiB0aGlzLmFsbEZyZXF1ZW5jaWVzLFxuICAgICAgc2FtcGxlUmF0ZTogIHRoaXMuc2FtcGxlUmF0ZVxuICAgIH0pO1xuICAgIHRoaXMuZGVjb2RlSGFuZGxlcnMgPSBbXTtcbiAgICB0aGlzLmpvYnMgPSBcbiAgICAgIHtiZWZvcmVQcm9jZXNzOiAgW119O1xuICB9XG5cbiAgcHJvY2Vzc0J1ZmZlcihidWZmZXIpIHtcbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgdGhpcy5fcnVuSm9icygnYmVmb3JlUHJvY2VzcycsIGJ1ZmZlcik7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWNpYmVsVGhyZXNob2xkICYmIChHb2VydHplbC5VdGlsaXRpZXMuYXZlcmFnZURlY2liZWxzKGJ1ZmZlcikgPCB0aGlzLm9wdGlvbnMuZGVjaWJlbFRocmVzaG9sZCkpIHsgcmV0dXJuIHJlc3VsdDsgfVxuICAgIC8vIERvd25zYW1wbGUgYnkgY2hvb3NpbmcgZXZlcnkgTnRoIHNhbXBsZS5cbiAgICBHb2VydHplbC5VdGlsaXRpZXMuZWFjaERvd25zYW1wbGUoYnVmZmVyLCB0aGlzLm9wdGlvbnMuZG93bnNhbXBsZVJhdGUsIChzYW1wbGUsaSxkb3duU2FtcGxlZEJ1ZmZlckxlbmd0aCk9PiB7XG4gICAgICBsZXQgd2luZG93ZWRTYW1wbGUgPSBHb2VydHplbC5VdGlsaXRpZXMuZXhhY3RCbGFja21hbihzYW1wbGUsIGksIGRvd25TYW1wbGVkQnVmZmVyTGVuZ3RoKTtcbiAgICAgIHRoaXMuZ29lcnR6ZWwucHJvY2Vzc1NhbXBsZSh3aW5kb3dlZFNhbXBsZSk7XG4gICAgfSk7XG4gICAgbGV0IGVuZXJnaWVzID0ge1xuICAgICAgaGlnaDogW10sXG4gICAgICBsb3c6ICBbXVxuICAgIH07XG4gICAgZm9yIChsZXQgZlR5cGUgb2YgWydoaWdoJywgJ2xvdyddKSB7XG4gICAgICBsZXQgaSA9IDA7XG4gICAgICB3aGlsZSAoaSA8IHRoaXNbYCR7ZlR5cGV9RnJlcXVlbmNpZXNgXS5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGYgPSB0aGlzW2Ake2ZUeXBlfUZyZXF1ZW5jaWVzYF1baV07XG4gICAgICAgIGVuZXJnaWVzW2ZUeXBlXS5wdXNoKHRoaXMuZ29lcnR6ZWwuZW5lcmdpZXNbZl0pO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgodGhpcy5vcHRpb25zLmZpbHRlciAmJiB0aGlzLm9wdGlvbnMuZmlsdGVyKHtnb2VydHplbDogdGhpcy5nb2VydHplbCwgZW5lcmdpZXN9KSkgfHwgIXRoaXMub3B0aW9ucy5maWx0ZXIpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5fZW5lcmd5UHJvZmlsZVRvQ2hhcmFjdGVyKHRoaXMuZ29lcnR6ZWwpO1xuICAgICAgaWYgKCgodmFsdWUgPT09IHRoaXMuZmlyc3RQcmV2aW91c1ZhbHVlKSB8fCAodGhpcy5vcHRpb25zLnJlcGVhdE1pbiA9PT0gMCkpICYmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJlcGVhdE1pbiAhPT0gMCkgeyB0aGlzLnJlcGVhdENvdW50ZXIgKz0gMTsgfVxuICAgICAgICBpZiAodGhpcy5yZXBlYXRDb3VudGVyID09PSB0aGlzLm9wdGlvbnMucmVwZWF0TWluKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICAgIGZvciAobGV0IGhhbmRsZXIgb2YgQXJyYXkuZnJvbSh0aGlzLmRlY29kZUhhbmRsZXJzKSkge1xuICAgICAgICAgICAgc2V0VGltZW91dChoYW5kbGVyKHZhbHVlKSwgMCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlcGVhdENvdW50ZXIgPSAwO1xuICAgICAgICB0aGlzLmZpcnN0UHJldmlvdXNWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmdvZXJ0emVsLnJlZnJlc2goKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgb24oZXZlbnROYW1lLCBoYW5kbGVyKSB7XG4gICAgc3dpdGNoIChldmVudE5hbWUpIHtcbiAgICAgIGNhc2UgXCJkZWNvZGVcIjogcmV0dXJuIHRoaXMuZGVjb2RlSGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICB9XG4gIH1cblxuICBjYWxpYnJhdGUobXVsdGlwbGllcil7XG4gICAgaWYgKG11bHRpcGxpZXIgPT0gbnVsbCkgeyBtdWx0aXBsaWVyID0gMTsgfVxuICAgIGlmICghdGhpcy5qb2JzLmJlZm9yZVByb2Nlc3MpIHsgdGhpcy5qb2JzLmJlZm9yZVByb2Nlc3MgPSBbXTsgfVxuICAgIHJldHVybiB0aGlzLmpvYnMuYmVmb3JlUHJvY2Vzcy5wdXNoKChidWZmZXIsIGR0bWYpID0+IGR0bWYub3B0aW9ucy5kZWNpYmVsVGhyZXNob2xkID0gR29lcnR6ZWwuVXRpbGl0aWVzLmF2ZXJhZ2VEZWNpYmVscyhidWZmZXIpICogbXVsdGlwbGllcik7XG4gIH1cblxuICAvLyBwcml2YXRlXG5cbiAgX2VuZXJneVByb2ZpbGVUb0NoYXJhY3RlcihyZWdpc3Rlcikge1xuICAgIGxldCB7IGVuZXJnaWVzIH0gPSByZWdpc3RlcjtcbiAgICAvLyBGaW5kIGhpZ2ggZnJlcXVlbmN5LlxuICAgIGxldCBoaWdoRnJlcXVlbmN5ID0gMC4wO1xuICAgIGxldCBoaWdoRnJlcXVlbmN5RW5nZXJneSA9IDAuMDtcbiAgICBmb3IgKHZhciBmIG9mIEFycmF5LmZyb20odGhpcy5oaWdoRnJlcXVlbmNpZXMpKSB7XG4gICAgICBpZiAoKGVuZXJnaWVzW2ZdID4gaGlnaEZyZXF1ZW5jeUVuZ2VyZ3kpICYmIChlbmVyZ2llc1tmXSA+IHRoaXMub3B0aW9ucy5lbmVyZ3lUaHJlc2hvbGQpKSB7XG4gICAgICAgIGhpZ2hGcmVxdWVuY3lFbmdlcmd5ID0gZW5lcmdpZXNbZl07XG4gICAgICAgIGhpZ2hGcmVxdWVuY3kgPSBmO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBGaW5kIGxvdyBmcmVxdWVuY3kuXG4gICAgbGV0IGxvd0ZyZXF1ZW5jeSA9IDAuMDtcbiAgICBsZXQgbG93RnJlcXVlbmN5RW5lcmd5ID0gMC4wO1xuICAgIGZvciAoZiBvZiBBcnJheS5mcm9tKHRoaXMubG93RnJlcXVlbmNpZXMpKSB7XG4gICAgICBpZiAoKGVuZXJnaWVzW2ZdID4gbG93RnJlcXVlbmN5RW5lcmd5KSAmJiAoZW5lcmdpZXNbZl0gPiB0aGlzLm9wdGlvbnMuZW5lcmd5VGhyZXNob2xkKSkge1xuICAgICAgICBsb3dGcmVxdWVuY3lFbmVyZ3kgPSBlbmVyZ2llc1tmXTtcbiAgICAgICAgbG93RnJlcXVlbmN5ID0gZjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZnJlcXVlbmN5VGFibGVbbG93RnJlcXVlbmN5XSA/ICB0aGlzLmZyZXF1ZW5jeVRhYmxlW2xvd0ZyZXF1ZW5jeV1baGlnaEZyZXF1ZW5jeV0gOiBudWxsO1xuICB9XG5cbiAgX3J1bkpvYnMoam9iTmFtZSwgYnVmZmVyKSB7XG4gICAgaWYgKHRoaXMuam9ic1tqb2JOYW1lXSkge1xuICAgICAgbGV0IHF1ZXVlTGVuZ3RoID0gdGhpcy5qb2JzW2pvYk5hbWVdLmxlbmd0aDtcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIHJldHVybiAoKCkgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIHdoaWxlIChpIDwgcXVldWVMZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLmpvYnNbam9iTmFtZV0ucG9wKCkoYnVmZmVyLCB0aGlzKTtcbiAgICAgICAgICByZXN1bHQucHVzaChpKyspO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KSgpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERUTUY7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IEdPRVJUWkVMX0FUVFJJQlVURVMgPSBbJ2ZpcnN0UHJldmlvdXMnLCAnc2Vjb25kUHJldmlvdXMnLCAndG90YWxQb3dlcicsICdmaWx0ZXJMZW5ndGgnLCAnZW5lcmdpZXMnLCAncGhhc2VzJ10sXG4gICAgICBHT0VSVFpFTF9BVFRSSUJVVEVTX0xFTkdUSCA9IEdPRVJUWkVMX0FUVFJJQlVURVMubGVuZ3RoLFxuICAgICAgeyBhdGFuMiwgY29zLCBzaW4sIFBJIH0gPSBNYXRoO1xuLyoqXG4gKiBBIHB1cmUgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgR29lcnR6ZWwgYWxnb3JpdGhtLCBhIG1lYW5zIG9mIGVmZmljaWVudCBERlQgc2lnbmFsIHByb2Nlc3NpbmcuXG4gKiBAcGFyYW0ge29iamVjdH0gICAgICAgIG9wdGlvbnNcbiAqIEBwYXJhbSB7YXJyYXl9ICAgICAgICAgb3B0aW9ucy5mcmVxdWVuY2llcyAtIFRoZSBmcmVxdWVuY2llcyB0byBiZSBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge251bWJlcj00NDEwMH0gIG9wdGlvbnMuc2FtcGxlUmF0ZSAgLSBUaGUgc2FtcGxlIHJhdGUgb2YgdGhlIHNhbXBsZXMgdG8gYmUgcHJvY2Vzc2VkLiAgRGVmYXVsdHMgdG8gNDQxMDAuXG4gKiBAcGFyYW0ge2Jvb2xlYW49ZmFsc2V9IG9wdGlvbnMuZ2V0UGhhc2UgICAgLSBDYWxjdWxhdGVzIHRoZSBjdXJyZW50IHBoYXNlIGFuZ2xlIG9mIGVhY2ggZnJlcXVlbmN5LiAgRGlzYWJsZWQgYnkgZGVmYXVsdC5cbiAqL1xuY2xhc3MgR29lcnR6ZWwge1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICB0aGlzLm9wdGlvbnMgICAgICAgID0gb3B0aW9ucztcbiAgICB0aGlzLnNhbXBsZVJhdGUgICAgID0gb3B0aW9ucy5zYW1wbGVSYXRlICB8fCA0NDEwMDtcbiAgICB0aGlzLmZyZXF1ZW5jaWVzICAgID0gb3B0aW9ucy5mcmVxdWVuY2llcyB8fCBbXTtcbiAgICB0aGlzLl9pbml0aWFsaXplQ29uc3RhbnRzKHRoaXMuZnJlcXVlbmNpZXMpO1xuICAgIHRoaXMucmVmcmVzaCgpO1xuICB9XG4gIC8qKlxuICAgKiBSdW5zIGEgc2FtcGxlIHRocm91Z2ggdGhlIEdvZXJ0emVsIGFsZ29yaXRobSwgdXBkYXRpbmcgdGhlIGVuZXJnaWVzIGZvciBlYWNoIGZyZXF1ZW5jeS5cbiAgICogQHBhcmFtIHtudW1iZXJ9IHNhbXBsZSBcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZyA9IG5ldyBHb2VydHplbCh7ZnJlcXVlbmNpZXM6IFs2OTcsIDc3MCwgODUyLCA5NDFdfSk7XG4gICAqIGcucHJvY2Vzc1NhbXBsZSg0Mik7XG4gICAqIGcucHJvY2Vzc1NhbXBsZSg4NCk7XG4gICAqIGcuZW5lcmdpZXM7XG4gICAqIC8vIHsgJzY5Nyc6IDAuODk4MDI5Mjk3MDA1NTExMixcbiAgICogLy8gICAnNzcwJzogMC44OTc1OTUzMTM5NjY3MTQyLFxuICAgKiAvLyAgICc4NTInOiAwLjg5NzA1NjUzODMyMzA1MTQsXG4gICAqIC8vICAgJzk0MSc6IDAuODk2NDEwNDQwMzM0ODIyOCB9XG4gICAqL1xuICBwcm9jZXNzU2FtcGxlKHNhbXBsZSkge1xuICAgIHRoaXMuY3VycmVudFNhbXBsZSA9IHNhbXBsZTtcbiAgICBjb25zdCBsZW4gPSB0aGlzLmZyZXF1ZW5jaWVzLmxlbmd0aDtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUoaSA8IGxlbil7XG4gICAgICBsZXQgZnJlcXVlbmN5ID0gdGhpcy5mcmVxdWVuY2llc1tpXTtcbiAgICAgIHRoaXMuX2dldEVuZXJneU9mRnJlcXVlbmN5KHNhbXBsZSwgZnJlcXVlbmN5KTtcbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFJlLWluaXRpYWxpemVzIHRoZSBzdGF0ZSBieSB6ZXJvaW5nLW91dCBhbGwgdmFsdWVzLiAgWW91IHdpbGwgbmVlZCB0byBkbyB0aGlzIGZvciBldmVyeSB3aW5kb3cgeW91IHdpc2ggdG8gYW5hbHl6ZS5cbiAgICovXG4gIHJlZnJlc2goKSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlKGk8R09FUlRaRUxfQVRUUklCVVRFU19MRU5HVEgpe1xuICAgICAgbGV0IGF0dHIgPSBHT0VSVFpFTF9BVFRSSUJVVEVTW2ldO1xuICAgICAgdGhpc1thdHRyXSA9IHt9O1xuICAgICAgaSsrO1xuICAgIH1cbiAgICB0aGlzLmZyZXF1ZW5jaWVzLmZvckVhY2goZnJlcXVlbmN5ID0+IHtcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIHdoaWxlKGk8R09FUlRaRUxfQVRUUklCVVRFU19MRU5HVEgpe1xuICAgICAgICBsZXQgYXR0ciA9IEdPRVJUWkVMX0FUVFJJQlVURVNbaV07XG4gICAgICAgIHRoaXNbYXR0cl1bZnJlcXVlbmN5XSA9IDAuMDtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgX2dldEVuZXJneU9mRnJlcXVlbmN5KHNhbXBsZSwgZnJlcXVlbmN5KSB7XG4gICAgbGV0IGYxID0gdGhpcy5maXJzdFByZXZpb3VzW2ZyZXF1ZW5jeV0sXG4gICAgICAgIGYyID0gdGhpcy5zZWNvbmRQcmV2aW91c1tmcmVxdWVuY3ldO1xuICAgIGNvbnN0IGNvZWZmaWNpZW50ID0gdGhpcy5jb2VmZmljaWVudFtmcmVxdWVuY3ldLFxuICAgICAgICAgIHNpbmUgICAgICAgID0gKHNhbXBsZSArIChjb2VmZmljaWVudCAqIGYxKSkgLSBmMjtcbiAgICBmMiA9IGYxO1xuICAgIGYxID0gc2luZTtcbiAgICB0aGlzLmZpbHRlckxlbmd0aFtmcmVxdWVuY3ldICs9IDE7XG4gICAgY29uc3QgcG93ZXIgICAgICA9ICgoZjIgKiBmMikgKyAoZjEgKiBmMSkpIC0gKGNvZWZmaWNpZW50ICogZjEgKiBmMiksXG4gICAgICAgICAgdG90YWxQb3dlciA9IHRoaXMudG90YWxQb3dlcltmcmVxdWVuY3ldICs9IHNhbXBsZSAqIHNhbXBsZTtcbiAgICBpZiAodG90YWxQb3dlciA9PT0gMCkgdGhpcy50b3RhbFBvd2VyW2ZyZXF1ZW5jeV0gPSAxO1xuICAgIHRoaXMuZW5lcmdpZXNbZnJlcXVlbmN5XSAgICAgICA9IHBvd2VyIC8gdG90YWxQb3dlciAvIHRoaXMuZmlsdGVyTGVuZ3RoW2ZyZXF1ZW5jeV07XG4gICAgaWYodGhpcy5vcHRpb25zLmdldFBoYXNlKSB7XG4gICAgICBsZXQgcmVhbCAgICAgID0gKGYxIC0gZjIgKiB0aGlzLmNvc2luZVtmcmVxdWVuY3ldKSxcbiAgICAgICAgICBpbWFnaW5hcnkgPSAoZjIgKiB0aGlzLnNpbmVbZnJlcXVlbmN5XSk7XG4gICAgICB0aGlzLnBoYXNlc1tmcmVxdWVuY3ldID0gYXRhbjIoaW1hZ2luYXJ5LCByZWFsKTtcbiAgICB9XG4gICAgdGhpcy5maXJzdFByZXZpb3VzW2ZyZXF1ZW5jeV0gID0gZjE7XG4gICAgdGhpcy5zZWNvbmRQcmV2aW91c1tmcmVxdWVuY3ldID0gZjI7XG4gIH1cblxuICBfaW5pdGlhbGl6ZUNvbnN0YW50cyhmcmVxdWVuY2llcykge1xuICAgIGNvbnN0IGxlbiA9IGZyZXF1ZW5jaWVzLmxlbmd0aDtcbiAgICBsZXQgZnJlcXVlbmN5LFxuICAgICAgICBub3JtYWxpemVkRnJlcXVlbmN5LFxuICAgICAgICBvbWVnYSxcbiAgICAgICAgY29zaW5lLFxuICAgICAgICBpID0gMDtcbiAgICB0aGlzLnNpbmUgICAgICAgID0ge30sXG4gICAgdGhpcy5jb3NpbmUgICAgICA9IHt9LFxuICAgIHRoaXMuY29lZmZpY2llbnQgPSB7fTtcbiAgICB3aGlsZShpPGxlbil7XG4gICAgICBmcmVxdWVuY3kgPSBmcmVxdWVuY2llc1tpXTtcbiAgICAgIG5vcm1hbGl6ZWRGcmVxdWVuY3kgPSBmcmVxdWVuY3kgLyB0aGlzLnNhbXBsZVJhdGU7XG4gICAgICBvbWVnYSAgPSAyLjAgKiBQSSAqIG5vcm1hbGl6ZWRGcmVxdWVuY3k7XG4gICAgICBjb3NpbmUgPSBjb3Mob21lZ2EpO1xuICAgICAgdGhpcy5zaW5lW2ZyZXF1ZW5jeV0gICAgICAgID0gc2luKG9tZWdhKTtcbiAgICAgIHRoaXMuY29zaW5lW2ZyZXF1ZW5jeV0gICAgICA9IGNvc2luZTtcbiAgICAgIHRoaXMuY29lZmZpY2llbnRbZnJlcXVlbmN5XSA9IDIuMCAqIGNvc2luZTtcbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuR29lcnR6ZWwuVXRpbGl0aWVzID0gcmVxdWlyZSgnLi9saWIvdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdvZXJ0emVsO1xuXG4iXX0=
