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
    end: isMobile ? "+=2500%" : "+=1800%", // Longer distance on mobile so fast swiping doesn't instantly skip text
    scrub: isMobile ? 1.5 : 1, // Heavy dampening on mobile to handle fast "hands-free" momentum swiping
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
gsap.set(".scroll-logo", { xPercent: -50 }); // GSAP strictly handles horizontal centering

// Part 0: Logo gently fades in and floats up to center
tl.to(".scroll-logo", { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.00)
  .to(".scroll-logo", { x: "30vw", y: "-38vh", scale: 0.55, duration: 0.15, ease: "power2.inOut" }, 0.10)
  .to(".blur-overlay", { opacity: 0, duration: 0.15, ease: "power2.inOut" }, 0.10);

// Part 1 enters strictly AFTER the logo has shrunk and moved away (0.25)
tl.to(".scroll-text-1", { y: 0, duration: 0.1, ease: "power2.out" }, 0.25);

// Part 2 enters normally (0.45)
tl.to(".scroll-text-2", { y: 0, duration: 0.1, ease: "power2.out" }, 0.45);

// Part 1, Part 2, and Logo all stay on screen together, then exit smoothly before Part 3
tl.to([".scroll-text-1", ".scroll-text-2"], { y: -window.innerHeight, duration: 0.1, ease: "power2.in" }, 0.70);
tl.to(".scroll-logo", { y: "-150vh", duration: 0.1, ease: "power2.in" }, 0.70);

// Part 3 enters
tl.to(".scroll-text-3", { y: 0, duration: 0.1, ease: "power2.out" }, 0.85);

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

