Rickshaw.namespace("Rickshaw.Graph.Renderer");

Rickshaw.Graph.Renderer = Rickshaw.Class.create( {

	initialize: function(args) {
		this.graph = args.graph;
		this.tension = args.tension || this.tension;
		this.useReducedData = args.useReducedData || this.useReducedData;
		this.steps = args.steps || this.steps;
		this.configure(args);
	},

	seriesPathFactory: function() {
		//implement in subclass
	},

	seriesStrokeFactory: function() {
		// implement in subclass
	},

	defaults: function() {
		return {
			tension: 0.8,
			strokeWidth: 2,
			unstack: true,
			padding: { top: 0.01, right: 0, bottom: 0.01, left: 0 },
			stroke: false,
			fill: false,
			useReducedData: true,
			steps: 500
		};
	},

	domain: function(data) {
		// Requires that at least one series contains some data
		var stackedData = data || this.graph.stackedData || this.graph.stackData();

		var xMin = +Infinity;
		var xMax = -Infinity;

		var yMin = +Infinity;
		var yMax = -Infinity;

		stackedData.forEach( function(series) {

			series.forEach( function(d) {

				if (d.y == null) return;

				var y = d.y + d.y0;

				if (y < yMin) yMin = y;
				if (y > yMax) yMax = y;
			} );

			if (!series.length) return;

			if (series[0].x < xMin) xMin = series[0].x;
			if (series[series.length - 1].x > xMax) xMax = series[series.length - 1].x;
		} );

		xMin -= (xMax - xMin) * this.padding.left;
		xMax += (xMax - xMin) * this.padding.right;

		yMin = this.graph.min === 'auto' ? yMin : this.graph.min || 0;
		yMax = this.graph.max === undefined ? yMax : this.graph.max;

		if (this.graph.min === 'auto' || yMin < 0) {
			yMin -= (yMax - yMin) * this.padding.bottom;
		}

		if (this.graph.max === undefined) {
			yMax += (yMax - yMin) * this.padding.top;
		}

		var windowXmax = this.graph.window.xMax;
		var windowXmin = this.graph.window.xMin;

		if (windowXmax !== undefined) {
			xMax = windowXmax;
		}
    else if (this.graph.xmax !== undefined) {
			xMax = this.graph.xmax;
		}

		if (windowXmin !== undefined) {
			xMin = windowXmin;
		}

		return { x: [xMin, xMax], y: [yMin, yMax] };
	},

	render: function(args) {

		args = args || {};

		var graph = this.graph;
		var series = args.series || graph.series;

		var vis = args.vis || graph.vis;
		vis.selectAll('*').remove();

		var data = series
			.filter(function(s) { return !s.disabled })
			.map(function(s) { return s.stack });

		if (this.useReducedData) {
			data = this._reduceData(data);
		}

		var pathNodes = vis.selectAll("path.path")
			.data(data)
			.enter().append("svg:path")
			.classed('path', true)
			.attr("d", this.seriesPathFactory());

		if (this.stroke) {
                        var strokeNodes = vis.selectAll('path.stroke')
                                .data(data)
                                .enter().append("svg:path")
				.classed('stroke', true)
				.attr("d", this.seriesStrokeFactory());
		}

		var i = 0;
		series.forEach( function(series) {
			if (series.disabled) return;
			series.path = pathNodes[0][i];
			if (this.stroke) series.stroke = strokeNodes[0][i];
			this._styleSeries(series);
			i++;
		}, this );

	},

	_reduceData: function(data) {
    // This function reduces the number of points in the data, by splitting
    // the data into a fixed number of segments (the number of segments is
    // this.steps).
    // For each segment up to 4 points from the original data are retained in
    // the reduced data set:
    // The first and last points within the segment
    // The points with the minimum and maximum y values
    //
    // If this.steps is large enough to ensure that each segment covers just
    // a couple pixels of width on the rendered chart then this reduced data
    // will render almost identically to the full data set.
    // It is important to retain the first and last points as data points may
    // not be distributed evenly through time.  If the segment is immediately
    // preceeded or followed by a long period of time without data then these
    // points are important to make sure that the corresponding line segment
    // is rendered at the correct vertical position.
    // It is important to preserve the points with the minimum and maximum
    // y values so that the shape of the chart is preserved, especially when
    // it contains very narrow peaks and troughs.
    return data.map(
			function(s) {
				if (s.length === 0) {
					return [];
				}
				else {
					var newSeries = [];
					var min = this.graph.window.xMin;
					if (min === undefined) {
						min = s[0].x;
					}
					var max = this.graph.window.xMax;
					if (max === undefined) {
						max = s.slice(-1)[0].x;
					}

					var step = (max - min) / this.steps;

					var last = {};
					var addedX = [];

					s.forEach( function(d) {
						var rounded = Math.floor(d.x / step);
						if (last.rounded != rounded) {
							if (last.lastx !== undefined) {
								if (last.minx < last.maxx && addedX.indexOf(last.minx) == -1) {
									newSeries.push({x: last.minx, y: last.min, y0: last.miny0});
									addedX.push(last.minx);
								}
								if (addedX.indexOf(last.maxx) == -1) {
									newSeries.push({x: last.maxx, y: last.max, y0: last.maxy0});
									addedX.push(last.maxx);
								}
								if (last.minx > last.maxx && addedX.indexOf(last.minx) == -1) {
									newSeries.push({x: last.minx, y: last.min, y0: last.miny0});
									addedX.push(last.minx);
								}
								if (addedX.indexOf(last.lastx) == -1) {
									newSeries.push({x: last.lastx, y: last.lasty, y0: last.y0});
									addedX.push(last.lastx);
								}
							}
							last = {rounded: rounded, minx: d.x, maxx: d.x, min: d.y, max: d.y, y0: d.y0};
							if (addedX.indexOf(d.x) == -1) {
								newSeries.push(d);
								addedX.push(d.x);
							}
						}
						else {
							if (d.y < last.min) {
								last.min = d.y;
								last.minx = d.x;
								last.miny0 = d.y0;
							}
							else if (d.y > last.max) {
								last.max = d.y;
								last.maxx = d.x;
								last.maxy0 = d.y0;
							}
							last.lastx = d.x;
							last.lasty = d.y;
							last.y0 = d.y0;
						}
					});
					return newSeries;
				}
		}, this);
	},

	_styleSeries: function(series) {

		var fill = this.fill ? series.color : 'none';
		var stroke = this.stroke ? series.color : 'none';

		series.path.setAttribute('fill', fill);
		series.path.setAttribute('stroke', stroke);
		series.path.setAttribute('stroke-width', this.strokeWidth);

		if (series.className) {
			d3.select(series.path).classed(series.className, true);
		}
		if (series.className && this.stroke) {
			d3.select(series.stroke).classed(series.className, true);
		}
	},

	configure: function(args) {

		args = args || {};

		Rickshaw.keys(this.defaults()).forEach( function(key) {

			if (!args.hasOwnProperty(key)) {
				this[key] = this[key] || this.graph[key] || this.defaults()[key];
				return;
			}

			if (typeof this.defaults()[key] == 'object') {

				Rickshaw.keys(this.defaults()[key]).forEach( function(k) {

					this[key][k] =
						args[key][k] !== undefined ? args[key][k] :
						this[key][k] !== undefined ? this[key][k] :
						this.defaults()[key][k];
				}, this );

			} else {
				this[key] =
					args[key] !== undefined ? args[key] :
					this[key] !== undefined ? this[key] :
					this.graph[key] !== undefined ? this.graph[key] :
					this.defaults()[key];
			}

		}, this );
	},

	setStrokeWidth: function(strokeWidth) {
		if (strokeWidth !== undefined) {
			this.strokeWidth = strokeWidth;
		}
	},

	setTension: function(tension) {
		if (tension !== undefined) {
			this.tension = tension;
		}
	}
} );

