// Normalizes a DRF list response — paginated ({results:[...]}) or not ([...])
// — into a real array. `res?.results || res || []` (used all over this app)
// looks equivalent but isn't: if the API ever returns a non-array truthy
// object with no `results` key (an unexpected error shape, a single object,
// etc.), that pattern assigns the raw object to state, and the first
// `.map`/`.filter` on it throws — a render-time crash with no try/catch to
// catch it, since it happens in JSX, not in the async loader.
export default function asArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  return [];
}
