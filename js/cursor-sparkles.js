(() => {
  'use strict';

  const sparkleCount = 50;
  const palette = [
    '#FFF1C7',
    '#FFE0A0',
    '#FFD078',
    '#FFB84D',
    '#F29A38'
  ];
  const tiny = [];
  const stars = [];
  const starVelocity = [];
  const starX = [];
  const starY = [];
  const tinyX = [];
  const tinyY = [];
  const tinyVelocity = [];
  let x = 0;
  let oldX = 0;
  let y = 0;
  let oldY = 0;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;

  function randomColor() {
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function createSparkleElement(width, height, className = '') {
    const element = document.createElement('span');
    element.className = className;
    element.style.position = 'absolute';
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.overflow = 'visible';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '9999';
    return element;
  }

  function updateViewport() {
    viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  }

  function moveSparkle(element, nextX, nextY) {
    // Transforms keep the sparkle on the compositor without invalidating the
    // whole document layout on every cursor tick.
    element.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  }

  function updateStar(index) {
    starVelocity[index] -= 1;

    if (starVelocity[index]) {
      starY[index] += 1 + Math.random() * 3;
      starX[index] += (index % 5 - 2) / 5;
      if (starY[index] < viewportHeight + window.scrollY) {
        moveSparkle(stars[index], starX[index], starY[index]);
      } else {
        stars[index].style.visibility = 'hidden';
        starVelocity[index] = 0;
      }
      return;
    }

    tinyVelocity[index] = 50;
    tinyY[index] = starY[index];
    tinyX[index] = starX[index];
    moveSparkle(tiny[index], tinyX[index], tinyY[index]);
    tiny[index].style.width = '2px';
    tiny[index].style.height = '2px';
    tiny[index].style.backgroundColor = stars[index].firstElementChild.style.backgroundColor;
    stars[index].style.visibility = 'hidden';
    tiny[index].style.visibility = 'visible';
  }

  function updateTiny(index) {
    tinyVelocity[index] -= 1;
    if (tinyVelocity[index] === 25) {
      tiny[index].style.width = '1px';
      tiny[index].style.height = '1px';
    }

    if (tinyVelocity[index]) {
      tinyY[index] += 1 + Math.random() * 3;
      tinyX[index] += (index % 5 - 2) / 5;
      if (tinyY[index] < viewportHeight + window.scrollY) {
        moveSparkle(tiny[index], tinyX[index], tinyY[index]);
      } else {
        tiny[index].style.visibility = 'hidden';
        tinyVelocity[index] = 0;
      }
    } else {
      tiny[index].style.visibility = 'hidden';
    }
  }

  function animate() {
    if (Math.abs(x - oldX) > 1 || Math.abs(y - oldY) > 1) {
      oldX = x;
      oldY = y;
      for (let index = 0; index < sparkleCount; index += 1) {
        if (starVelocity[index]) continue;
        const color = randomColor();
        const star = stars[index];
        starX[index] = x;
        starY[index] = y + 1;
        moveSparkle(star, starX[index], starY[index]);
        star.firstElementChild.style.backgroundColor = color;
        star.lastElementChild.style.backgroundColor = color;
        star.style.visibility = 'visible';
        starVelocity[index] = 50;
        break;
      }
    }

    for (let index = 0; index < sparkleCount; index += 1) {
      if (starVelocity[index]) updateStar(index);
      if (tinyVelocity[index]) updateTiny(index);
    }
    window.setTimeout(animate, 40);
  }

  function initialize() {
    for (let index = 0; index < sparkleCount; index += 1) {
      const tinySparkle = createSparkleElement(3, 3, 'cursor-sparkle cursor-sparkle-tiny');
      tinySparkle.style.visibility = 'hidden';
      document.body.appendChild(tinySparkle);
      tiny.push(tinySparkle);
      starVelocity[index] = 0;
      tinyVelocity[index] = 0;

      const star = createSparkleElement(5, 5, 'cursor-sparkle');
      star.style.backgroundColor = 'transparent';
      star.style.visibility = 'hidden';
      // Keep the original 5px scale, with both rays centered so the mark is
      // always a visible cross rather than two offset/detached strokes.
      const verticalRay = createSparkleElement(1, 5);
      const horizontalRay = createSparkleElement(5, 1);
      verticalRay.style.top = '0px';
      verticalRay.style.left = '2px';
      horizontalRay.style.top = '2px';
      horizontalRay.style.left = '0px';
      star.append(verticalRay, horizontalRay);
      document.body.appendChild(star);
      stars.push(star);
    }

    updateViewport();
    animate();
  }

  function updatePointerPosition(event) {
    if (event.pointerType === 'touch') return;
    x = event.pageX ?? event.clientX + window.scrollX;
    y = event.pageY ?? event.clientY + window.scrollY;
  }

  document.addEventListener('pointermove', updatePointerPosition, { passive: true });
  document.addEventListener('mousemove', updatePointerPosition, { passive: true });
  window.addEventListener('resize', updateViewport, { passive: true });
  window.addEventListener('scroll', updateViewport, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
