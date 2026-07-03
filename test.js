const searchStr = "research intern -senior";
const regex = /(-?)(?:"([^"]+)"|(\S+))/g;
let match;
while ((match = regex.exec(searchStr)) !== null) {
  const isNegated = match[1] === '-';
  const term = (match[2] || match[3]).toLowerCase();
  console.log(`isNegated: ${isNegated}, term: "${term}"`);
}
