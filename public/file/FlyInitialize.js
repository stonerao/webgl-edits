var FlyInitialize = function () {
	"use strict";
	var pointImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABv0lEQVRYhcXXPW8TQRDG8Z9PAoEIggIkKFFMA1JAVECH0qBAx5dJSUkq6KGHDwBlRAd0IS6giCPKJDIF5MWRTTEUtyd8JviFxHePtM3O3fxHo9HuPo2IMKHm8AgPcBvXcCHFfuIbPuM93mF/oqwRMW41I+JlROzH5NpP/zTH5R8VPBMRzyKiNwV4WL2IWEm5pipgPiLWjgEe1lr8oxtHwe9ExPYJwgttp9wlXiPKQ9jEB1yedDKnVAf30S42Bgs4i4+4NSN4oRbu4hCygcDTCuCwkFj404F5fMWpCgqAX7iBdtGB5QrhEmuZvAPnsYVzFRYAB7iaYakGuMRcyrBYA7zQYiafyrq00IiIDi7VVMD3RkT0cLqmAvrZ+G9mqwy7NfJ3M2zWWMBmJr8c6lIrw2qNBazWeRR3cSXDHt5UDIfX2Cuu4ya+qPY6vomN4hxo43lFcHiBDf5+kn0y+7uhhXvyGSg9yQ7xRP5wnJU6idEtNoaP4jYeYmcG8J2Uu13aPcosJBOxfoKeYD2mMCaD1mwlIvrHAPfjP63Z4LoeudE8mALcjYhX6d+R+Yed0SjN4bGyPb+YYj+U7flbE9rz39+RdVVm7zuhAAAAAElFTkSuQmCC";

	this.scene;
	this.camera;
	this.renderer;
	this.controls;

	this.GId = '';
	this.tipconts;
	this.container;
	this.parentCont;
	this.Tweens = [];
	this.Result = false;

	this.init = function (cts, config) {
		var conts = parseCts(cts);
		if (detector() && conts != null) {
			try {
				var config = config || {};
				df_Config = $.extend(true, {}, defaultConfig, config);

				thm.parentCont = conts;
				thm.GId += THREE.Math.generateUUID();
				var TId = conts.attr('id') + '_' + thm.GId;
				thm.container = creatContainer(TId);
				thm.parentCont.html(thm.container);
				InitControls();
				if (df_Config.loading)
					loading(thm.container);
				loadTexture()
				initiate();
				init3DMesh();
				is_Init = true;
			} catch (e) {
				thm.Result = 'error! Initialization Error!';
				console.log(e);
				creatError(conts);
				return;
			}
		} else
			thm.Result = 'error! Not Support WebGL!';
	};

	this.render = function (func) {
		if (is_Init) {
			if (!testing())
				return;
			removeLoading(thm.container);
			if (is_Stats)
				df_Stats.begin();
			renderers(func);
			initTween();
		}
	};

	this.rotaScene = function (angle, times) {
		if (is_Init) {
			angle = isNaN(angle * 1) ? 0 : Math.max(0, angle);
			times = isNaN(times * 1) ? 1 : Math.max(100, times);
			rotateScene(angle, times);
		}
	};

	this.disposeRender = function () {
		if (is_Init && testing()) {
			removeEvent();
			thm.controls.dispose();
			thm.container.remove();
			thm.renderer.forceContextLoss();
			thm.renderer.domElement = null;
			thm.renderer.context = null;
			thm.renderer = null;
			is_Init = false;
		}
	};

	var thm = this;
	var df_Stats,
		is_Stats = false; //stats
	var df_Raycaster,
		df_Mouse,
		df_Intersects,
		df_MouseEvent = false; //tips
	var df_Clock,
		df_Width = 0,
		df_Height = 0,
		is_Init = false,
		txues = {},
		df_Config = {}; //essential

	var defaultConfig = {
		stats: false,
		loading: false,
		background: {
			color: '#1E1F22',
			opacity: 1
		},
		camera: {
			position: [0, 100, 0],
			near: 1,
			far: 10000
		},
		controls: {
			enablePan: true,
			enableZoom: true,
			enableRotate: true,
			enableDamping: true, //是否阻尼
			dampingFactor: 0.1, //阻尼系数
			keyPanSpeed: 5.0,
			panSpeed: 0.1, //平移系数
			zoomSpeed: 0.1, //缩放系数
			rotateSpeed: 0.013, //旋转系数
			distance: [0, 2048], //缩放距离区间
			polarAngle: [-Infinity, Infinity], //上下旋转区间
			azimuthAngle: [-Infinity, Infinity], //左右旋转区间
		},
		light: {
			Ambient: {
				color: '#FFFFFF',
				strength: 1.0
			},
			isHemisphere: false,
			hemisphere: {
				color: '#EFEFEF',
				groundColor: '#EFEFEF',
				strength: 0.7,
				position: [0, 0, 2000]
			},
		},

		texture: {}
	};

	function initiate() {

		thm.scene = new THREE.Scene();
		df_Clock = new THREE.Clock();

		var wh = getWH();
		df_Width = wh.w;
		df_Height = wh.h;
		var cm = df_Config.camera,
			bg = df_Config.background;
		 
		thm.camera = new THREE.OrthographicCamera(wh.w / - 2, wh.w / 2, wh.h / 2, wh.h / - 2, cm.near, cm.far);

		thm.camera.position.set(cm.position[0], cm.position[1], cm.position[2]);
		// thm.camera.lookAt(thm.scene.position);
		thm.camera.zoom = df_Config.scale;

		const s = df_Config.scale;
		thm.scene.scale.set(s, s, s); 

		thm.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
		thm.renderer.setSize(df_Width, df_Height);
		thm.renderer.setClearColor(bg.color, bg.opacity);


		setLight(thm.scene, df_Config.light);
		// controls
		thm.controls = new THREE.OrbitControls(thm.camera, thm.container[0]);
		setControls(thm.controls, df_Config.controls);
		// state
		is_Stats = (df_Config.stats === true) ? true : false;
		if (is_Stats) {
			df_Stats = new Stats();
			thm.container.append($(df_Stats.dom));
		}

		thm.container.append($(thm.renderer.domElement));

		window.addEventListener('resize', onWindowResize, false);

		// mouse event
		df_Raycaster = new THREE.Raycaster();
		df_Mouse = new THREE.Vector2();
		thm.renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
		thm.renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
	}

	function init3DMesh(opts) {
		thm.planeArr=[];
		thm.flyGroup = new THREE.Group();
		thm.scene.add(thm.flyGroup);
		thm.FLY = new InitFlys({
			img: pointImg
		})
	}


	thm.addFly = function (data) {

		const _pointImg = data.img;
		const lines = data.data;

		const ImgsType = [101];
		for (let i = 0; i < lines.length; i++) {
			const elem = lines[i];
			const { options, data, uuid } = elem;
			const { img, speed, size, dpi, length, type, color } = options;

			let _pimg = null;
			if (_pointImg) _pimg = _pointImg;
			if (img) _pimg = img;

			let _data = data.map((d) => new THREE.Vector3(d.x, d.y, d.z));

			// 曲线
			if (options.curve) {
				const curve = new THREE.CatmullRomCurve3(_data);
				_data = curve.getPoints(_data.length * 10);
			} 
		 

			if (ImgsType.includes(type)) {
				const w = size * 2;
				const map = new THREE.TextureLoader().load(_pimg);
				const _geometry = new THREE.PlaneGeometry(w, w);
				const _material = new THREE.MeshBasicMaterial({
					side: THREE.DoubleSide,
					transparent: true,
					color: new THREE.Color(color),
					map: map
				});
				const plane = new THREE.Mesh(_geometry, _material);


				const totals = [];
				totals[0] = 0;
				for (let j = 1; j < _data.length; j++) {
					totals[j] = _data[j - 1].distanceTo(_data[j]);
				}
				const g = new THREE.Group();

				g._data = _data;
				g._totals = totals;
				g._time = 0;
				g._index = 0;
				g._type = "plane";
				g._speed = speed;
				g.position.set(_data[0].x, _data[0].y, 1);

				g.add(plane);
				g.lookAt(new THREE.Vector3(_data[1].x, _data[1].y, 1));

				plane.rotation.y = -Math.PI / 2;
				plane.rotation.z = -Math.PI / 2;

				plane.renderOrder = 10;

				thm.planeArr.push(g);

				thm.flyGroup.add(g);

			} else {
				line.name = uuid;
				line.renderOrder = 5;
				line.position.y = 1;
				// 点 


				const flyMesh = thm.Flys.add({
					img: _pimg,
					data: _data,
					speed,
					size,
					dpi,
					length,
					type,
					color: new THREE.Color(color),
					repeat: Infinity,
					material: {
						depthWrite: false,
						blending: 2
					},
					onComplete: function () {
					},
					onRepeat(val) {
					}
				});
				flyMesh.name = elem.uuid;
				thm.flyGroup.add(flyMesh);
			}
		}

	}


	function animation(dt) {
		if (thm.FLY) {
			thm.FLY.animation(dt);
		}
		if (Array.isArray(thm.planeArr)){ 
			thm.planeArr.forEach((elem) => {
			elem._time += dt * elem._speed;
			const index = elem._index % (elem._totals.length - 1);
			const nextI = elem._totals[index + 1];

			const curr = elem._data[index];
			const next = elem._data[index + 1];

			const p = curr.clone().lerp(next, elem._time / nextI);
			elem.position.copy(p);
			elem.lookAt(next);

			if (elem._time >= nextI) {
				elem._index++;
				elem._time = 0;
			};
		})
		}
	}
	//-
	function loadTexture() {
		var txueLoader = new THREE.TextureLoader();
		var _n = df_Config.texture;
		for (var k in _n) {
			txues['_' + k] = txueLoader.load(_n[k], function (tex) {
				tex.anisotropy = 10;
				tex.minFilter = tex.magFilter = THREE.LinearFilter;
			});
		}
	}

	// mouse event
	function onDocumentMouseMove(event) {
		event.preventDefault();

		if (!df_MouseEvent) {
			df_Mouse.x = (event.layerX / df_Width) * 2 - 1;
			df_Mouse.y = - (event.layerY / df_Height) * 2 + 1;
			df_Raycaster.setFromCamera(df_Mouse, thm.camera);

		}
	}

	function onDocumentMouseDown(event) {
		event.preventDefault();
		df_Mouse.x = (event.layerX / df_Width) * 2 - 1;
		df_Mouse.y = -(event.layerY / df_Height) * 2 + 1;
		df_Raycaster.setFromCamera(df_Mouse, thm.camera);
		var intersects = df_Raycaster.intersectObjects(thm.clickArr);
		if (intersects.length != 0 && event.buttons == 1) {
			console.log(intersects[0].object)
		} else { }

	}

	function onWindowResize(event) {
		var wh = getWH();
		df_Width = wh.w;
		df_Height = wh.h;
		thm.camera.aspect = wh.w / wh.h;
		thm.renderer.setSize(wh.w, wh.h);
		thm.controls.reset();
	}

	function renderers(func) {
		var fnc = toFunction(func);
		var Animations = function () {
			if (is_Init) {
				fnc.bind(thm)();

				var delta = df_Clock.getDelta();
				if (delta > 0) {
					animation(delta);
				}
				thm.controls.update();
				requestAnimationFrame(Animations);
				thm.renderer.render(thm.scene, thm.camera);
			}
		};
		Animations();
	}

	function testing() {
		return thm.renderer instanceof THREE.WebGLRenderer;
	}

	function rotateScene(angle, times) {
		var ay = thm.scene.rotation.y + angle;
		new TWEEN.Tween(thm.scene.rotation).to({
			y: ay
		}, times).start();
	}

	function initTween() {
		for (var k = thm.Tweens.length - 1; k >= 0; k--) {
			thm.Tweens[k].start(TWEEN.now());
		}
	}

	function getWH() {
		return {
			w: thm.container.width(),
			h: thm.container.height()
		};
	}

	function setControls(controls, opts) {
		controls.enablePan = opts.enablePan;
		controls.enableKeys = opts.enablePan;
		controls.enableZoom = opts.enableZoom;
		controls.enableRotate = opts.enableRotate;

		controls.enableDamping = opts.enableDamping;
		controls.dampingFactor = opts.dampingFactor;
		controls.keyPanSpeed = opts.keyPanSpeed;

		controls.panSpeed = opts.panSpeed;
		controls.zoomSpeed = opts.zoomSpeed;
		controls.rotateSpeed = opts.rotateSpeed;

		controls.minDistance = opts.distance[0];
		controls.maxDistance = opts.distance[1];
		controls.minPolarAngle = opts.polarAngle[0];
		controls.maxPolarAngle = opts.polarAngle[1];
		controls.minAzimuthAngle = opts.azimuthAngle[0];
		controls.maxAzimuthAngle = opts.azimuthAngle[1];
		// controls.mouseDownPrevent = opts.mouseDownPrevent;
	}

	function setLight(scene, opts) {
		scene.add(new THREE.AmbientLight(opts.Ambient.color, opts.Ambient.strength));
		if (opts.isHemisphere) {
			var lh = opts.hemisphere,
				hLight = new THREE.HemisphereLight(lh.color, lh.groundColor, lh.strength);
			hLight.position.set(lh.position[0], lh.position[2], lh.position[1]);
			scene.add(hLight);
		}
	}

	function detector() {
		try {
			return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('experimental-webgl');
		} catch (e) {
			return false;
		}
	}

	function isFunction(a) {
		return Object.prototype.toString.call(a) === '[object Function]';
	}

	function toFunction(a) {
		var b = Object.prototype.toString.call(a) === '[object Function]';
		return b ? a : function (o) { };
	}

	function parseCts(cts) {
		var $dom = (typeof cts == 'object') ? $(cts) : $('#' + cts);
		if ($dom.length <= 0)
			return null;
		return $dom;
	}

	function removeEvent() {
		window.removeEventListener('resize', onWindowResize, false);
		thm.renderer.domElement.removeEventListener('mousemove', onDocumentMouseMove, false);
		thm.renderer.domElement.removeEventListener('mousedown', onDocumentMouseDown, false);
	}


	// loading
	function loading(container) {
		var loading = $('<div id="t_loading"></div>');
		loading.css({
			'position': 'absolute',
			'top': 0,
			'left': 0,
			'right': 0,
			'bottom': 0,
			'z-index': 20000
		});
		var loadImg = 'data:image/gif;base64,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';
		loading.css('background', '#000000 url(' + loadImg + ') center center no-repeat');
		$(container).append(loading);
	}

	function removeLoading(container) {
		$(container).children('div#t_loading').css({
			'background': 'none',
			'display': 'none'
		});
	}

	function creatContainer(id) {
		var containers = $('<div></div>');
		containers.css("cssText", "height:100%;width:100%;position:relative !important");
		containers.attr('id', id);
		return containers;
	}

	function creatError(conts, errorText) {
		var error = $('<div class="data-error"></div>'),
			error_text = errorText || '数据错误。。。';
		if (undefined != conts) {
			var ctxt = "color:#fff;position:absolute;top:49%;width:100%;text-align:center;";
			error.css("cssText", ctxt);
			conts.html(error.html(error_text));
		}
	}

};

/**
* 飞线
* THREE = r98
*/

class InitFlys {
	constructor({ img } = opts) {
		if (!THREE) {
			return console.error("THREE! THREE! THREE!");
		}

		if (img) {
			this.texture = new THREE.TextureLoader().load(img)
		}

		this.array = []; // 存储线条
	}

	add(opts = {}) {
		// 传递属性
		const {
			color = new THREE.Color(), // 颜色 
			opacity = 1,  // 透明度
			data = [], // 线条数据
			size = 1, // 粒子大小
			length = 1, // 粒子展示长度
			repeat = 1, // 飞线循环次数
			speed = 1, // 速度
			dpi = 1, // 速度
			type = 1, // 飞线样式类型
			img, // 材质贴图
			onComplete = () => { }, // 飞线结束
			onRepeat = () => { }, // 飞线单次结束
		} = opts;

		const _material = opts.material || {}; // 外部传递材质属性 优先级第一

		const shader = this.getShader(type); // type shader

		const geometry = new THREE.BufferGeometry();

		// 材质贴图
		const _data = this.tranformPath(data, dpi);
		const indexArr = _data.map((e, i) => i);

		const texture = !!img ? new THREE.TextureLoader().load(img) : this.texture;
		const total = parseFloat(indexArr.length) + parseFloat(length);
		const material = new THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				u_map: { value: texture },
				u_size: { value: size },
				u_length: { value: length },
				u_opacity: { value: opacity },
				u_color: { value: color },
				u_total: { value: total },
			},
			transparent: true,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});


		const mesh = new THREE.Points(geometry, material);


		geometry.setFromPoints(_data);
		geometry.addAttribute("a_index", new THREE.Float32BufferAttribute(indexArr, 1));

		mesh._time = 0; // 当前时间
		mesh._been = 0; // 当前次数
		mesh._speed = speed * 10.0; // 速度
		mesh._total = total; // 总时间
		mesh._repeat = repeat; // 总次数
		mesh._onRepeat = onRepeat; // 单次完结回调
		mesh._onComplete = onComplete; // 结束回调
		mesh.name = THREE.Math.generateUUID();

		this.array.push(mesh);

		// 替换属性
		for (const key in _material) {
			if (material.hasOwnProperty(key)) {
				material[key] = _material[key];
			}
		}

		return mesh;
	}
	/**
	* [remove 删除]
	* @param   {Object}  mesh  [当前飞线]
	*/
	remove(mesh) {
		mesh.material.dispose();
		mesh.geometry.dispose();
		this.array = this.array.filter(elem => elem.name != mesh.name);
		mesh.parent.remove(mesh);
		mesh = null;
	}
	/**
	* 根据线条组生成路径
	* @param {*} arr 需要生成的线条组
	* @param {*} dpi 密度
	*/
	tranformPath(arr, dpi = 1) {
		const vecs = [];
		for (let i = 1; i < arr.length; i++) {
			let src = arr[i - 1];
			let dst = arr[i];
			let s = new THREE.Vector3(src.x, src.y, src.z);
			let d = new THREE.Vector3(dst.x, dst.y, dst.z);
			let length = s.distanceTo(d) * dpi;
			let len = Math.round(length);
			for (let i = 0; i <= len; i++) {
				vecs.push(s.clone().lerp(d, i / len))
			}
		}
		return vecs;
	}
	/**
	 * [animation 动画]
	 * @param   {Number}  delta  [执行动画间隔时间]
	 */
	animation(dt = 0.015) {
		for (let i = 0; i < this.array.length; i++) {
			const mesh = this.array[i];

			if (mesh._been >= mesh._repeat) {
				mesh._onComplete();
				this.remove(mesh);
				return false;
			}

			if (mesh._time >= mesh._total) {
				mesh._time = 0;
				mesh._been++;
				mesh._onRepeat(mesh._been);
			}

			mesh.material && (mesh.material.uniforms.time.value = mesh._time);
			mesh._time += dt * mesh._speed;
		}
	}

	/**
	* [getTotal 获取当前数据的总长度]
	* @param   {Array}  data  [数据]]
	*/
	getTotal(data) {
		let total = 0;
		for (let i = 0; i < data.length - 1; i++) {
			const elem = (new THREE.Vector3()).copy(data[i]);
			const next = (new THREE.Vector3()).copy(data[i + 1]);

			total += elem.distanceTo(next);
		};
		return total;
	}

	// 获取当前类型的shader
	getShader(type) {
		let vertex, fragment;
		switch (type) {
			case 1:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = val;
                size = size * 0.5 + val * u_size * 0.5;
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity)  * _map;
            
             `
				break;
			case 2:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 1.0; 
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			case 3:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = val + 0.1;
                size = size * 0.5 + val * u_size * 0.5;
            } else {
                v_opacity = 0.02;
                size = u_size * 0.8;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			case 4:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = sin(val * PI);
                size =  sin(val * PI) * size;
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			case 5:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 0.1;
                size =  0.8 * u_size;
                if (a_index < index && a_index > index - 1.0) {
                    v_opacity = 1.0; 
                    size = u_size;
                }
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			case 6:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total); 
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 0.1;
                size =  0.8 * u_size;
                float i = (a_index - (index - u_length));
                if (mod(i, 15.0) < 0.9) { 
                    size = u_size;
                    v_opacity = 0.5;
                }
                if (a_index < index && a_index > index - 1.0) {
                    v_opacity = 1.0; 
                    size = u_size;
                }
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			case 7:
				vertex = `
            float size = u_size;
            float index = mod(time, u_total); 
            float PI = 3.1415926;
            float t = 15.0;
            if (a_index < index && a_index > index - u_length * t) {
                v_opacity = 0.0; 
                float m = mod(index - a_index, t);
                if (m < 1.0) {
                    float baisc = 1.0 - (index - a_index) / (u_length * t) + 1.0 / u_length;
                    v_opacity = baisc + 0.1;
                    size =( baisc * u_size * 0.6) + u_size* 0.6;
                }
            } else {
                v_opacity = 0.0;
            }`;
				fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
				break;
			default:
		}
		const vertexShader = `uniform float time;
        uniform float u_size;
        uniform float u_length;
        uniform float u_total;

        attribute float a_index;

        varying float v_opacity;
        void main() {
            ${vertex}
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * 300.0 / (-mvPosition.z);
        }`;
		const fragmentShader = `uniform float u_opacity;
        uniform vec3 u_color;
        uniform sampler2D u_map;

        varying float v_opacity;

        void main() {
            ${fragment}
        }`;
		return {
			vertexShader,
			fragmentShader
		}
	}

}

function InitControls() {
	// This set of controls performs orbiting, dollying (zooming), and panning.
	// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
	//
	//    Orbit - left mouse / touch: one finger move
	//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
	//    Pan - right mouse, or arrow keys / touch: three finger swipe

	THREE.OrbitControls = function (object, domElement) {

		this.object = object;

		this.domElement = (domElement !== undefined) ? domElement : document;

		// Set to false to disable this control
		this.enabled = true;

		// "target" sets the location of focus, where the object orbits around
		this.target = new THREE.Vector3();

		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
		this.minAzimuthAngle = -Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians

		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.25;

		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Set to false to disable panning
		this.enablePan = true;
		this.panSpeed = 1.0;

		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

		// Set to false to disable use of the keys
		this.enableKeys = true;

		// The four arrow keys
		this.keys = {
			LEFT: 37,
			UP: 38,
			RIGHT: 39,
			BOTTOM: 40
		};

		// Mouse buttons
		this.mouseButtons = {
			ORBIT: THREE.MOUSE.LEFT,
			ZOOM: THREE.MOUSE.MIDDLE,
			PAN: THREE.MOUSE.RIGHT
		};

		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		//
		// public methods
		//

		this.getPolarAngle = function () {

			return spherical.phi;

		};

		this.getAzimuthalAngle = function () {

			return spherical.theta;

		};

		this.reset = function () {

			scope.target.copy(scope.target0);
			scope.object.position.copy(scope.position0);
			scope.object.zoom = scope.zoom0;

			scope.object.updateProjectionMatrix();
			// scope.dispatchEvent( changeEvent );

			scope.update();

			state = STATE.NONE;

		};

		// this method is exposed, but perhaps it would be better if we can make it private...
		this.update = function () {

			var offset = new THREE.Vector3();

			// so camera.up is the orbit axis
			var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
			var quatInverse = quat.clone().inverse();

			var lastPosition = new THREE.Vector3();
			var lastQuaternion = new THREE.Quaternion();

			return function update() {

				var position = scope.object.position;

				offset.copy(position).sub(scope.target);

				// rotate offset to "y-axis-is-up" space
				offset.applyQuaternion(quat);

				// angle from z-axis around y-axis
				spherical.setFromVector3(offset);

				if (scope.autoRotate && state === STATE.NONE) {

					rotateLeft(getAutoRotationAngle());

				}

				spherical.theta += sphericalDelta.theta;
				spherical.phi += sphericalDelta.phi;

				// restrict theta to be between desired limits
				spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

				// restrict phi to be between desired limits
				spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

				spherical.makeSafe();

				spherical.radius *= scale;

				// restrict radius to be between desired limits
				spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

				// move target to panned location
				scope.target.add(panOffset);

				offset.setFromSpherical(spherical);

				// rotate offset back to "camera-up-vector-is-up" space
				offset.applyQuaternion(quatInverse);

				position.copy(scope.target).add(offset);

				scope.object.lookAt(scope.target);

				if (scope.enableDamping === true) {

					scale += (1 - scale) * scope.dampingFactor * .6;

					sphericalDelta.theta *= (1 - scope.dampingFactor);
					sphericalDelta.phi *= (1 - scope.dampingFactor);

					panOffset.multiplyScalar((1 - scope.dampingFactor));

				} else {
					scale = 1;
					sphericalDelta.set(0, 0, 0);

					panOffset.set(0, 0, 0);

				}


				// update condition is:
				// min(camera displacement, camera rotation in radians)^2 > EPS
				// using small-angle approximation cos(x/2) = 1 - x^2 / 8

				if (zoomChanged ||
					lastPosition.distanceToSquared(scope.object.position) > EPS ||
					8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

					// scope.dispatchEvent( changeEvent );

					lastPosition.copy(scope.object.position);
					lastQuaternion.copy(scope.object.quaternion);
					zoomChanged = false;

					return true;

				}

				return false;

			};

		}();

		this.dispose = function () {

			scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
			scope.domElement.removeEventListener('mousedown', onMouseDown, false);
			scope.domElement.removeEventListener('wheel', onMouseWheel, false);

			scope.domElement.removeEventListener('touchstart', onTouchStart, false);
			scope.domElement.removeEventListener('touchend', onTouchEnd, false);
			scope.domElement.removeEventListener('touchmove', onTouchMove, false);

			document.removeEventListener('mousemove', onMouseMove, false);
			document.removeEventListener('mouseup', onMouseUp, false);

			window.removeEventListener('keydown', onKeyDown, false);

			//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

		};

		//
		// internals
		//

		var scope = this;

		// var changeEvent = { type: 'change' };
		// var startEvent = { type: 'start' };
		// var endEvent = { type: 'end' };

		var STATE = {
			NONE: -1,
			ROTATE: 0,
			DOLLY: 1,
			PAN: 2,
			TOUCH_ROTATE: 3,
			TOUCH_DOLLY: 4,
			TOUCH_PAN: 5
		};

		var state = STATE.NONE;

		var EPS = 0.000001;

		// current position in spherical coordinates
		var spherical = new THREE.Spherical();
		var sphericalDelta = new THREE.Spherical();

		var scale = 1;
		var panOffset = new THREE.Vector3();
		var zoomChanged = false;

		var rotateStart = new THREE.Vector2();
		var rotateEnd = new THREE.Vector2();
		var rotateDelta = new THREE.Vector2();

		var panStart = new THREE.Vector2();
		var panEnd = new THREE.Vector2();
		var panDelta = new THREE.Vector2();

		var dollyStart = new THREE.Vector2();
		var dollyEnd = new THREE.Vector2();
		var dollyDelta = new THREE.Vector2();

		function getAutoRotationAngle() {

			return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

		}

		function getZoomScale() {

			return Math.pow(0.95, scope.zoomSpeed);

		}

		function rotateLeft(angle) {

			sphericalDelta.theta -= angle;

		}

		function rotateUp(angle) {

			sphericalDelta.phi -= angle;

		}

		var panLeft = function () {

			var v = new THREE.Vector3();

			return function panLeft(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
				v.multiplyScalar(-distance);

				panOffset.add(v);

			};

		}();

		var panUp = function () {

			var v = new THREE.Vector3();

			return function panUp(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
				v.multiplyScalar(distance);

				panOffset.add(v);

			};

		}();

		// deltaX and deltaY are in pixels; right and down are positive
		var pan = function () {

			var offset = new THREE.Vector3();

			return function pan(deltaX, deltaY) {

				var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

				if (scope.object instanceof THREE.PerspectiveCamera) {

					// perspective
					var position = scope.object.position;
					offset.copy(position).sub(scope.target);
					var targetDistance = offset.length();

					// half of the fov is center to top of screen
					targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

					// we actually don't use screenWidth, since perspective camera is fixed to screen height
					panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
					panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

				} else if (scope.object instanceof THREE.OrthographicCamera) {

					// orthographic
					panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
					panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);

				} else {

					// camera neither orthographic nor perspective
					console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
					scope.enablePan = false;

				}

			};

		}();

		function dollyIn(dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale /= dollyScale;

			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;

			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
				scope.enableZoom = false;

			}

		}

		function dollyOut(dollyScale) {

			if (scope.object instanceof THREE.PerspectiveCamera) {

				scale *= dollyScale;

			} else if (scope.object instanceof THREE.OrthographicCamera) {

				scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
				scope.object.updateProjectionMatrix();
				zoomChanged = true;

			} else {

				console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
				scope.enableZoom = false;

			}

		}

		//
		// event callbacks - update the object state
		//

		function handleMouseDownRotate(event) {

			//console.log( 'handleMouseDownRotate' );

			rotateStart.set(event.clientX, event.clientY);

		}

		function handleMouseDownDolly(event) {

			//console.log( 'handleMouseDownDolly' );

			dollyStart.set(event.clientX, event.clientY);

		}

		function handleMouseDownPan(event) {

			//console.log( 'handleMouseDownPan' );

			panStart.set(event.clientX, event.clientY);

		}

		function handleMouseMoveRotate(event) {

			//console.log( 'handleMouseMoveRotate' );

			rotateEnd.set(event.clientX, event.clientY);
			rotateDelta.subVectors(rotateEnd, rotateStart);

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			// rotating across whole screen goes 360 degrees around
			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

			// rotating up and down along whole screen attempts to go 360, but limited to 180
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

			rotateStart.copy(rotateEnd);

			scope.update();

		}

		function handleMouseMoveDolly(event) {

			//console.log( 'handleMouseMoveDolly' );

			dollyEnd.set(event.clientX, event.clientY);

			dollyDelta.subVectors(dollyEnd, dollyStart);

			if (dollyDelta.y > 0) {

				dollyIn(getZoomScale());

			} else if (dollyDelta.y < 0) {

				dollyOut(getZoomScale());

			}

			dollyStart.copy(dollyEnd);

			scope.update();

		}

		function handleMouseMovePan(event) {

			//console.log( 'handleMouseMovePan' );

			panEnd.set(event.clientX, event.clientY);

			panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

			pan(panDelta.x, panDelta.y);

			panStart.copy(panEnd);

			scope.update();

		}

		function handleMouseUp(event) {

			// console.log( 'handleMouseUp' );

		}

		function handleMouseWheel(event) {

			// console.log( 'handleMouseWheel' );

			if (event.deltaY < 0) {

				dollyOut(getZoomScale());

			} else if (event.deltaY > 0) {

				dollyIn(getZoomScale());

			}

			scope.update();

		}

		function handleKeyDown(event) {

			//console.log( 'handleKeyDown' );

			switch (event.keyCode) {

				case scope.keys.UP:
					pan(0, -scope.panSpeed * 7);
					scope.update();
					break;

				case scope.keys.BOTTOM:
					pan(0, scope.panSpeed * 7);
					scope.update();
					break;

				case scope.keys.LEFT:
					pan(-scope.panSpeed * 7, 0);
					scope.update();
					break;

				case scope.keys.RIGHT:
					pan(scope.panSpeed * 7, 0);
					scope.update();
					break;

			}

		}

		function handleTouchStartRotate(event) {

			//console.log( 'handleTouchStartRotate' );

			rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

		}

		function handleTouchStartDolly(event) {

			//console.log( 'handleTouchStartDolly' );

			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;

			var distance = Math.sqrt(dx * dx + dy * dy);

			dollyStart.set(0, distance);

		}

		function handleTouchStartPan(event) {

			//console.log( 'handleTouchStartPan' );

			panStart.set(event.touches[0].pageX, event.touches[0].pageY);

		}

		function handleTouchMoveRotate(event) {

			//console.log( 'handleTouchMoveRotate' );

			rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
			rotateDelta.subVectors(rotateEnd, rotateStart);

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			// rotating across whole screen goes 360 degrees around
			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

			// rotating up and down along whole screen attempts to go 360, but limited to 180
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

			rotateStart.copy(rotateEnd);

			scope.update();

		}

		function handleTouchMoveDolly(event) {

			//console.log( 'handleTouchMoveDolly' );

			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;

			var distance = Math.sqrt(dx * dx + dy * dy);

			dollyEnd.set(0, distance);

			dollyDelta.subVectors(dollyEnd, dollyStart);

			if (dollyDelta.y > 0) {

				dollyOut(getZoomScale());

			} else if (dollyDelta.y < 0) {

				dollyIn(getZoomScale());

			}

			dollyStart.copy(dollyEnd);

			scope.update();

		}

		function handleTouchMovePan(event) {

			//console.log( 'handleTouchMovePan' );

			panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

			panDelta.subVectors(panEnd, panStart);

			pan(panDelta.x, panDelta.y);

			panStart.copy(panEnd);

			scope.update();

		}

		function handleTouchEnd(event) {

			//console.log( 'handleTouchEnd' );

		}

		//
		// event handlers - FSM: listen for events and reset state
		//

		function onMouseDown(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			if (event.button === scope.mouseButtons.ORBIT) {

				if (scope.enableRotate === false) return;

				handleMouseDownRotate(event);

				state = STATE.ROTATE;

			} else if (event.button === scope.mouseButtons.ZOOM) {

				if (scope.enableZoom === false) return;

				handleMouseDownDolly(event);

				state = STATE.DOLLY;

			} else if (event.button === scope.mouseButtons.PAN) {

				if (scope.enablePan === false) return;

				handleMouseDownPan(event);

				state = STATE.PAN;

			}

			if (state !== STATE.NONE) {

				document.addEventListener('mousemove', onMouseMove, false);
				document.addEventListener('mouseup', onMouseUp, false);

				// scope.dispatchEvent( startEvent );

			}

		}

		function onMouseMove(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			if (state === STATE.ROTATE) {

				if (scope.enableRotate === false) return;

				handleMouseMoveRotate(event);

			} else if (state === STATE.DOLLY) {

				if (scope.enableZoom === false) return;

				handleMouseMoveDolly(event);

			} else if (state === STATE.PAN) {

				if (scope.enablePan === false) return;

				handleMouseMovePan(event);

			}

		}

		function onMouseUp(event) {

			if (scope.enabled === false) return;

			handleMouseUp(event);

			document.removeEventListener('mousemove', onMouseMove, false);
			document.removeEventListener('mouseup', onMouseUp, false);

			// scope.dispatchEvent( endEvent );

			state = STATE.NONE;

		}

		function onMouseWheel(event) {

			if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;

			event.preventDefault();
			event.stopPropagation();

			handleMouseWheel(event);

			// scope.dispatchEvent( startEvent ); // not sure why these are here...
			// scope.dispatchEvent( endEvent );

		}

		function onKeyDown(event) {

			if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

			handleKeyDown(event);

		}

		function onTouchStart(event) {

			if (scope.enabled === false) return;

			switch (event.touches.length) {

				case 1: // one-fingered touch: rotate

					if (scope.enableRotate === false) return;

					handleTouchStartRotate(event);

					state = STATE.TOUCH_ROTATE;

					break;

				case 2: // two-fingered touch: dolly

					if (scope.enableZoom === false) return;

					handleTouchStartDolly(event);

					state = STATE.TOUCH_DOLLY;

					break;

				case 3: // three-fingered touch: pan

					if (scope.enablePan === false) return;

					handleTouchStartPan(event);

					state = STATE.TOUCH_PAN;

					break;

				default:

					state = STATE.NONE;

			}

			// if ( state !== STATE.NONE ) {

			// scope.dispatchEvent( startEvent );

			// }

		}

		function onTouchMove(event) {

			if (scope.enabled === false) return;

			event.preventDefault();
			event.stopPropagation();

			switch (event.touches.length) {

				case 1: // one-fingered touch: rotate

					if (scope.enableRotate === false) return;
					if (state !== STATE.TOUCH_ROTATE) return; // is this needed?...

					handleTouchMoveRotate(event);

					break;

				case 2: // two-fingered touch: dolly

					if (scope.enableZoom === false) return;
					if (state !== STATE.TOUCH_DOLLY) return; // is this needed?...

					handleTouchMoveDolly(event);

					break;

				case 3: // three-fingered touch: pan

					if (scope.enablePan === false) return;
					if (state !== STATE.TOUCH_PAN) return; // is this needed?...

					handleTouchMovePan(event);

					break;

				default:

					state = STATE.NONE;

			}

		}

		function onTouchEnd(event) {

			if (scope.enabled === false) return;

			handleTouchEnd(event);

			// scope.dispatchEvent( endEvent );

			state = STATE.NONE;

		}

		function onContextMenu(event) {

			event.preventDefault();

		}

		//

		scope.domElement.addEventListener('contextmenu', onContextMenu, false);

		scope.domElement.addEventListener('mousedown', onMouseDown, false);
		scope.domElement.addEventListener('wheel', onMouseWheel, false);

		scope.domElement.addEventListener('touchstart', onTouchStart, false);
		scope.domElement.addEventListener('touchend', onTouchEnd, false);
		scope.domElement.addEventListener('touchmove', onTouchMove, false);

		window.addEventListener('keydown', onKeyDown, false);

		// force an update at start

		this.update();

	};

	THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
	THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;
}