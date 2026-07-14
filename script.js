gsap.registerPlugin(ScrollTrigger);

// CRITICAL MOBILE FIX: Prevent the entire timeline from jumping and recalculating 
// violently when the mobile browser's URL bar hides or shows during scrolling.
ScrollTrigger.config({ ignoreMobileResize: true });

const canvas = document.getElementById("hero-lightpass");
const context = canvas.getContext("2d", { alpha: false }); // alpha: false heavily optimizes performance

const isMobile = window.innerWidth <= 768;

// Forcefully intercept mobile touch events to kill the endless native browser coasting
if (isMobile) {
  ScrollTrigger.normalizeScroll(true);
}

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
      // If the user scrolled to this frame while it was loading, draw it immediately!
      if (Math.round(imageSeq.frame) === index) {
        render();
      }
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

// 3. Request all remaining frames immediately so the browser can download them at max network speed
Promise.all(priorityPromises).then(() => {
  for (let i = PRIORITY_FRAMES; i < frameCount; i++) {
    loadFrame(i);
  }
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
    end: isMobile ? "+=2000%" : "+=3500%", // Drastically reduced on mobile to prevent thumb fatigue, kept slow on PC
    scrub: isMobile ? 1 : 0.5, // Exactly 1-second glide on mobile after finger releases
    anticipatePin: 1,
    pin: true,
    fastScrollEnd: isMobile ? true : false, // Optimizes mobile if you swipe extremely fast
    preventOverlaps: true, // Prevents glitching on mobile scroll reversal
  }
});

// CRITICAL FIX: Force the video image sequence to span EXACTLY the full timeline duration (1.0)
tl.to(imageSeq, {
  frame: frameCount - 1,
  snap: "frame",
  ease: "none",
  duration: 1, 
  onUpdate: render
}, 0);

// Initial state: push them down exactly 120vh, prepare the scrollbar
gsap.set([".scroll-text-1", ".scroll-text-2", ".scroll-text-3"], { y: "120vh" });
gsap.set(".scroll-logo", { xPercent: -50 }); // GSAP strictly handles horizontal centering
gsap.set("#progress-bar", { scaleY: 0 }); // Explicitly set initial state to prevent CSS conflicts

// BALANCED TIMELINE:
// Text is distributed evenly across the video so there are no massive gaps between texts,
// and no massive empty scroll at the end of the video.

// Dynamically shorten intervals strictly on mobile without touching PC
const tP1 = isMobile ? 0.12 : 0.15;
const tP2 = isMobile ? 0.28 : 0.35;
const tExit = isMobile ? 0.55 : 0.60;
const tP3 = isMobile ? 0.72 : 0.80;

// Part 0: Logo gently fades in and floats up
tl.to(".scroll-logo", { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, 0.00)
  .to(".scroll-logo", { x: "30vw", y: "-38vh", scale: 0.55, duration: 0.10, ease: "power2.inOut" }, 0.05)
  .to(".blur-overlay", { opacity: 0, duration: 0.10, ease: "none" }, 0.05);

// Part 1 enters smoothly
tl.to(".scroll-text-1", { y: 0, duration: 0.1, ease: "power2.out" }, tP1);

// Part 2 enters smoothly
tl.to(".scroll-text-2", { y: 0, duration: 0.1, ease: "power2.out" }, tP2);

// Part 1, Part 2, and Logo all exit smoothly together
tl.to([".scroll-text-1", ".scroll-text-2"], { y: "-120vh", duration: 0.1, ease: "power2.in" }, tExit);
tl.to(".scroll-logo", { y: "-150vh", duration: 0.1, ease: "power2.in" }, tExit);

// Part 3 enters and sits until the video ends, meaning the next section appears shortly after!
tl.to(".scroll-text-3", { y: 0, duration: 0.1, ease: "power2.out" }, tP3);

// TIGHTLY bind the progress bar to the master timeline spanning the entire duration (0 to 1)
tl.fromTo("#progress-bar", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: 1 }, 0);

// Completely independent ScrollTrigger purely for showing/hiding the progress container
gsap.to("#progress-container", {
  scrollTrigger: {
    trigger: "#animation-section",
    start: "top top",
    end: isMobile ? "+=2000%" : "+=3500%", 
    toggleActions: "play reverse play reverse",
    fastScrollEnd: true
  },
  opacity: 1,
  duration: 0.3
});

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

