const THREE = require('three'); 
module.exports = {
    init() { 
        var geometry = new THREE.BoxBufferGeometry(1, 1, 1);
        return geometry.attributes.position.array;
    }
}