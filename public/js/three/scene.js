var theatre = {
	scenePaused: false, 
	expanded: false, 
	controlsEnabled: true, 		// toggle based on tab, link controls to
	nodeView: false
};

theatre.display=function(allData){	
	var camera, composite, container, controls, modalCanvas, particleLight, renderer, scene, selectHalo, tween, visualTimeline;
	var windowHalfX = window.innerWidth / 2;
	var windowHalfY = window.innerHeight / 2;
	var scopes = utils.extractScopes(allData);
	var timeline = utils.parseTimeline(allData.programSteps, allData.components);

	theatre.timeline = timeline;
	
	init(timeline);
	animate();
	
	function init(data) {

		
		scene = new THREE.Scene();
		
		// timeline elements

		particleLight = subroutines.TimeLight();
		particleLight.tween.start();
		particleLight.tween.onComplete(function(){
			particleLight.position.z=0;
			particleLight.tween.start();
		});
		scene.add( particleLight );

		composite = subroutines.Composite(data,scopes);
		theatre.maxSize = composite.maxSize;
		scene.add( composite );


		visualTimeline = subroutines.VisualTimeline(data, scopes);
		scene.add(visualTimeline);

		//will add the dotgrid to the scene;
		subroutines.dotGrid(scene,data,scopes,composite.maxSize);
		subroutines.skybox(scene, composite.maxSize);

		// PerspectiveCamera   method args: (field of view angle, aspectRatio, near, far)
		camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 100000 );
		var camDistPartial = composite.maxSize / 2;
		camera.position.x = -camDistPartial;
		camera.position.y = camDistPartial;
		camera.position.z = composite.maxSize / 2;
		var target = new THREE.Vector3(0, 0, composite.maxSize/2);
		// camera.lookAt(target);  // PLACED IN OrbitControls.js

		controls = new THREE.OrbitControls(camera, container, target);
		// controls.addEventListener( 'change', render );

		// theatre.camera = camera;
		// theatre.target = target;
		// scene.add(subroutines.Axes()[0]);
		// scene.add(subroutines.Axes()[1]);
		// scene.add(subroutines.Axes()[2]);
		selectHalo = subroutines.SelectHalo(scene);
		scene.add(selectHalo);

		// renderer
		renderer = new THREE.WebGLRenderer({antialias:true});
		renderer.setClearColor( 0x333333, 1);
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight - 86);  // hard-coded top offset
		// renderer.setSize( window.innerWidth, window.innerHeight-$(container).offset().top );
	
		container = document.getElementById('three-scene');
		container.appendChild(renderer.domElement);

		//modal
		// modal = createModal();
		// User interaction
		window.addEventListener( 'mousemove', onMouseMove, false );
		window.addEventListener( 'resize', onWindowResize, false );
		window.addEventListener( 'mouseup', onMouseUp, false);
	}

	function onWindowResize() {
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		// render();
	}

	function onMouseMove( e ) {

		var vector = new THREE.Vector3();
		var raycaster = new THREE.Raycaster();
		var dir = new THREE.Vector3();

		//extract that offset into external variable that doesn't have to be recalculated every time... later
		var x =  ( event.clientX / window.innerWidth ) * 2 - 1;
		var y = - ( (event.clientY-$(container).offset().top ) / window.innerHeight ) * 2 + 1;

		//check the type of camera
		if ( camera instanceof THREE.OrthographicCamera ) {
	    vector.set( x, y, - 1 ); // z = - 1 important!
	    vector.unproject( camera );
	    dir.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
	    raycaster.set( vector, dir );
		} else if ( camera instanceof THREE.PerspectiveCamera ) {
	    vector.set( x, y, 0.5 ); // z = 0.5 important!
	    vector.unproject( camera );
	    raycaster.set( camera.position, vector.sub( camera.position ).normalize() );
		}

		if (composite){
			var intersects = raycaster.intersectObjects( composite.children, true );	

				$("#three-modal").hide();

				composite.children.forEach(function( shape ) {
					shape.material.color.setRGB( shape.grayness, shape.grayness, shape.grayness );
					shape.material.opacity = 0;
				});

			} else {
				// If not expanded, do nothing
				if (!theatre.expanded) return;

				var selectedId=intersects[0].object.componentData.id;
				/*
				$("#three-modal").html( utils.displayText(intersects[0].object) );
				if (!$("#three-modal").is(":visible") ){
					$("#three-modal").fadeIn();
				}
				*/
				intersects[0].object.material.color.setRGB( 1, 1, 0 );
				composite.children.forEach(function( shape ) {
					if (shape.material.hasOwnProperty('opacity') ){
						shape.material.opacity = 1;
					}
					if (shape.componentData.id===selectedId){
						shape.material.color.setRGB( 1, 1, 0 );
					}
				});
			}

		}		
	}

	function onMouseUp () {

		if (theatre.expanded === false) return;

		var cameraSpeed = 1500;

		var vector = new THREE.Vector3();
		var raycaster = new THREE.Raycaster();
		var dir = new THREE.Vector3();

		//check the type of camera
		//extract that offset into an external variable that doesn't have to be recalculated every time... later
		var x =  ( event.clientX / window.innerWidth ) * 2 - 1;
		var y = - ( (event.clientY-$(container).offset().top ) / window.innerHeight ) * 2 + 1;
		if ( camera instanceof THREE.OrthographicCamera ) {
	    vector.set( x, y, - 1 ); // z = - 1 important!
	    vector.unproject( camera );
	    dir.set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
	    raycaster.set( vector, dir );
		} else if ( camera instanceof THREE.PerspectiveCamera ) {
	    vector.set( x, y, 0.5 ); // z = 0.5 important!
	    vector.unproject( camera );
	    raycaster.set( camera.position, vector.sub( camera.position ).normalize() );
		}

		if (composite){
			var intersects = raycaster.intersectObjects( composite.children, true );	

			//  if object is not clicked and not in nodeView, return to prior position
			if (intersects.length < 1 && theatre.nodeView) {  
				new TWEEN.Tween(camera.position).to(theatre.lastPosition, cameraSpeed).start();
				new TWEEN.Tween( camera.rotation ).to(theatre.lastRotation, cameraSpeed).start();

				if (document.getElementById("modal-canvas")){
					document.body.removeChild(document.getElementById("modal-canvas"));
				}
				theatre.nodeView = false;

			// if an object is clicked, enter nodeView and zoom in
			} else if (intersects.length > 0) { 
				// save the prior position before entering nodeView
				if (!theatre.nodeView) {
					theatre.lastPosition = new THREE.Vector3().copy( camera.position );
					theatre.lastRotation = new THREE.Quaternion().copy( camera.rotation );
				}

				theatre.currentNode = intersects[0];
				console.log('theatre.currentNode:', theatre.currentNode);
				// final camera position
				var newX = intersects[0].object.position.x - 800;			
				var newY = intersects[0].object.position.y + 800;
				var newZ = intersects[0].object.position.z - 300;
				var targetPosition = new THREE.Vector3(newX, newY, newZ);

				// camera rotation
					// use extra camera to find rotation at target location
				var nextCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
				nextCamera.position.x = targetPosition.x;
				nextCamera.position.y = targetPosition.y;
				nextCamera.position.z = targetPosition.z;
				nextCamera.lookAt(intersects[0].object.position);
				var endRotation = new THREE.Quaternion().copy( nextCamera.rotation );

				// camera motion on click - position & rotation
				new TWEEN.Tween(camera.position).to(targetPosition, cameraSpeed).start();
				new TWEEN.Tween( camera.rotation ).to(endRotation, cameraSpeed).start();
				nextCamera = null;

				// raphael code here?
				if ($("#modal-canvas").length===0){
					modal = createModal();
					utils.modal.donut(modal,event.clientX,event.clientY,intersects[0]);
					utils.modal.headline(modal,intersects[0]);
				} 

				theatre.nodeView = true;

			}
		}
	}


	function createModal(){
		
	  var canvas=document.createElement("DIV");
	  // TODO refactor these into CSS
	  canvas.id="modal-canvas";
	  canvas.style.position="fixed";
	  canvas.style.top="0px";
	  canvas.style.left="0px";
	  canvas.style.width=$(window).innerWidth()+"px";
	  canvas.style.height=$(window).innerHeight()+"px";
	
	  document.body.appendChild(canvas);
	  
	  var c = new Raphael('modal-canvas');
	  return c;
	}
	
	function animate() {
		requestAnimationFrame( animate );
		// controls.update();
		render();
	}

	theatre.nextNode = function() {
		console.log('index:',theatre.currentNode.object.componentData.timelineIndex);
		console.log('theatre.timeline:', theatre.timeline);
	};

	theatre.prevNode = function() {

	};

	theatre.pause=function(){
		theatre.scenePaused ? particleLight.tween.start() : particleLight.tween.stop();
		theatre.scenePaused=!theatre.scenePaused;
	};

	theatre.expand=function(){
		var action = theatre.expanded ? "collapse" : "expand";
		for (var i=0;i<composite.children.length;i++){
			composite.children[i][action].start();
			if (action==='collapse'){
				visualTimeline.hide.start();
				// gray out all shapes
				$("#three-modal").hide();
				composite.children.forEach(function( shape ) {
					shape.material.color.setRGB( shape.grayness, shape.grayness, shape.grayness );
					shape.material.opacity = 0;
				});
				// return to lastposition - not working right now
				// if (theatre.nodeView) {
				// 	new TWEEN.Tween(camera.position).to(theatre.lastPosition, cameraSpeed).start();
				// 	new TWEEN.Tween( camera.rotation ).to(theatre.lastRotation, cameraSpeed).start();
				// }

			} else {
				visualTimeline.show.start();
			}
		}
		theatre.expanded=!theatre.expanded;
	};


	function render() {
		TWEEN.update();
		renderer.render( scene, camera );
		// effect.render( scene, camera );			// This is used for stereoEffect
	}
};
