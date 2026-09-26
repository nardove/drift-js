/**
 * Re-maps a number from one range to another
 *
 * @param {number} current
 * @param {number} in_min
 * @param {number} in_max
 * @param {number} out_min
 * @param {number} out_max
 * @returns
 */
const mapNoise = (current, in_min, in_max, out_min, out_max) => {
  return (
    ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
  );
};

export { mapNoise };
