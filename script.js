gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById("hero-lightpass");
const context = canvas.getContext("2d", { alpha: false }); // alpha: false heavily optimizes performance

const isMobile = window.innerWidth <= 768;

// Adjust canvas resolution for portrait vs landscape
canvas.width = isMobile ? 720 : 1280;
canvas.height = isMobile ? 1280 : 720;

const frameCount = isMobile ? 180 : 239;
const currentFrame = index => {
  if (isMobile) {
    return `./frames-mobile/ezgif-frame-${(index + 1).toString().padStart(3, '0')}.jpg`;
  }
  return `./frames/ezgif-frame-${(index + 2).toString().padStart(3, '0')}.jpg`;
};

// Automatically reload the page when switching between mobile and desktop view 
// (Useful for when you toggle mobile mode in browser developer tools)
let wasMobile = isMobile;
window.addEventListener('resize', () => {
  const nowMobile = window.innerWidth <= 768;
  if (wasMobile !== nowMobile) {
    location.reload();
  }
});

const images = new Array(frameCount);
const imageSeq = {
  frame: 0
};

// --- OPTIMIZED IMAGE LOADING ---
const PRIORITY_FRAMES = 15; // Load first 15 frames immediately for smooth initial scroll

function loadFrame(index) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Use async decoding for non-first frames to prevent main thread blocking
    if (index > 0) img.decoding = "async";
    
    img.onload = () => {
      images[index] = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = currentFrame(index);
  });
}

// 1. Load priority frames first
const priorityPromises = [];
for (let i = 0; i < Math.min(PRIORITY_FRAMES, frameCount); i++) {
  priorityPromises.push(loadFrame(i));
}

// 2. Draw the first frame immediately once it loads (LCP optimization)
priorityPromises[0].then(img => {
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
});

// 3. Load the rest of the frames sequentially in the background
Promise.all(priorityPromises).then(() => {
  let currentIndex = PRIORITY_FRAMES;
  
  function loadNextBatch() {
    if (currentIndex >= frameCount) return;
    
    // Load frames in small batches to yield to main thread
    const BATCH_SIZE = 5;
    const batchPromises = [];
    
    for (let i = 0; i < BATCH_SIZE && currentIndex < frameCount; i++, currentIndex++) {
      batchPromises.push(loadFrame(currentIndex));
    }
    
    Promise.all(batchPromises).then(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadNextBatch);
      } else {
        setTimeout(loadNextBatch, 10);
      }
    });
  }
  
  loadNextBatch();
});

let lastDrawnFrame = -1;
function render() {
  const currentFrame = Math.round(imageSeq.frame);
  if (currentFrame !== lastDrawnFrame) {
    const img = images[currentFrame];
    if (img && img.complete) {
      // Only draw the image. We don't need to clear or fill the background 
      // because the image covers the entire canvas and alpha is disabled.
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      lastDrawnFrame = currentFrame;
    }
  }
}

// Master timeline with ScrollTrigger pinning
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#animation-section",
    start: "top top",
    end: isMobile ? "+=1500%" : "+=3000%", // Restored a longer scroll distance on PC so it's not too fast
    scrub: isMobile ? 1 : 0.1, // Smooth on mobile, instant stop on PC
    anticipatePin: 1,
    pin: true,
  }
});

// Animate the frames over the entire timeline duration
tl.to(imageSeq, {
  frame: frameCount - 1,
  snap: "frame",
  ease: "none",
  onUpdate: render,
  duration: 1 // Baseline duration for the timeline
}, 0);

// Initial state: push them down far enough to be completely out of the viewport on all screen sizes
gsap.set([".scroll-text-1", ".scroll-text-2", ".scroll-text-3"], { y: "120vh" });

// Part 0: Logo gently fades in and floats up to center
tl.to(".scroll-logo", { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.00)
  // Then it shrinks and moves to the right side and higher up, and we fade out the blur overlay
  .to(".scroll-logo", { x: "30vw", y: "-38vh", scale: 0.55, duration: 0.15, ease: "power2.inOut" }, 0.10)
  .to(".blur-overlay", { opacity: 0, duration: 0.15, ease: "power2.inOut" }, 0.10);

// Part 1
tl.to(".scroll-text-1", { y: 0, duration: 0.1, ease: "power2.out" }, 0.15);

// Part 2 (Appears slightly later on mobile to give more breathing room)
tl.to(".scroll-text-2", { y: 0, duration: 0.1, ease: "power2.out" }, isMobile ? 0.35 : 0.25);

// Exit Part 1 and Part 2 upwards before Part 3 enters
tl.to([".scroll-text-1", ".scroll-text-2"], {
  y: -window.innerHeight,
  duration: 0.1,
  ease: "power2.in"
}, 0.55);

// Logo exits upwards exactly in sync with Part 1 and Part 2
tl.to(".scroll-logo", { y: "-150vh", duration: 0.1, ease: "power2.in" }, 0.55);

// Part 3
tl.to(".scroll-text-3", { y: 0, duration: 0.1, ease: "power2.out" }, 0.75);

// Navbar and Scroll Indicator hide/show on scroll
let lastScrollTop = 0;
const navbar = document.getElementById('navbar');
const scrollIndicator = document.querySelector('.scroll-indicator');

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  // If scrolling down and scrolled past the navbar height
  if (scrollTop > lastScrollTop && scrollTop > 80) {
    // Hide navbar
    if (navbar) navbar.style.transform = 'translateY(-100%)';
  } else {
    // Show navbar
    if (navbar) navbar.style.transform = 'translateY(0)';
  }

  // Hide scroll indicator as soon as user starts scrolling
  if (scrollTop > 10) {
    if (scrollIndicator) {
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.transition = 'opacity 0.3s ease';
    }
  } else {
    if (scrollIndicator) {
      scrollIndicator.style.opacity = '1';
    }
  }

  lastScrollTop = scrollTop;
});

// Sync animation for the second section to appear smoothly as pinning ends
gsap.from("#second-section", {
  scrollTrigger: {
    trigger: "#second-section",
    start: "top 90%",
    end: "top 30%",
    scrub: true,
  },
  y: 150,
  opacity: 0,
  duration: 1
});
