const fs = require('fs');

const file = 'karalevha-client/src/components/StlPreview.tsx';
let content = fs.readFileSync(file, 'utf8');

const cleanupRegex = /return \(\) => \{\s*window\.removeEventListener\('resize', handleResize\);\s*cancelAnimationFrame\(animationFrameId\);\s*currentRef\?\.removeChild\(renderer\.domElement\);\s*renderer\.dispose\(\);\s*\};/;

const newCleanup = `return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentRef && renderer.domElement && currentRef.contains(renderer.domElement)) {
        currentRef.removeChild(renderer.domElement);
      }
      
      // Memory Leak Fix: Dispose geometry and materials
      scene.traverse((object: any) => {
        if (!object.isMesh) return;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material: any) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      renderer.dispose();
    };`;

content = content.replace(cleanupRegex, newCleanup);

fs.writeFileSync(file, content);
