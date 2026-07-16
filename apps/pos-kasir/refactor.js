const fs = require('fs');
const file = 'C:/Users/Digital Marketing/OneDrive/Desktop/project/DIGITALISASI-SS-PROJECT/apps/pos-kasir/app/kasir/KasirOrderClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Extract renderActiveCard
const startMarker = "  const renderActiveCard = (order: ParsedOrder) => {";
const endMarker = "  };\n\n  return (";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex) + "  };\n".length;

const originalFn = content.substring(startIndex, endIndex);

// 2. Transform into ActiveOrderCard
let newFn = originalFn
  .replace("const renderActiveCard = (order: ParsedOrder) => {", "const ActiveOrderCard = React.memo(({ order, isLocal, isEstimatedFuture, handlersRef }: any) => {")
  .replace(/localOrderIds\.has\(order\.id\)/g, "isLocal")
  .replace(/order\._effectiveReleaseTime > now/g, "isEstimatedFuture")
  .replace("const { rootItems, childrenMap } = order._parsedItems;", "const { rootItems, childrenMap } = order._parsedItems;\n    const { cancelOrder, markAsPreparing, handlePrintCustomerOnly, markAsCompleted, setReprintTargetOrder } = handlersRef.current;");

newFn = newFn.replace(/  \};\n$/, "}, (prev, next) => prev.order === next.order && prev.isLocal === next.isLocal && prev.isEstimatedFuture === next.isEstimatedFuture);\n");

// 3. Insert above KasirOrderClient
const exportDefault = "export default function KasirOrderClient(";
content = content.replace(exportDefault, newFn + "\n" + exportDefault);

// 4. Remove original renderActiveCard
content = content.replace(originalFn, "");

// 5. Replace mapped items
content = content.replace(/renderActiveCard\(order\)/g, "<ActiveOrderCard key={order.id} order={order} isLocal={localOrderIds.has(order.id)} isEstimatedFuture={order._effectiveReleaseTime > now} handlersRef={handlersRef} />");

// 6. Add handlersRef
const queryClientLine = "const queryClient = useQueryClient()";
const newQueryClient = "const queryClient = useQueryClient()\n  const handlersRef = useRef<any>({})\n  useEffect(() => {\n    handlersRef.current = { cancelOrder, markAsPreparing, handlePrintCustomerOnly, markAsCompleted, setReprintTargetOrder }\n  })";
content = content.replace(queryClientLine, newQueryClient);

// 7. Fix imports
if (!content.includes('import React,')) {
    content = content.replace("import { useEffect", "import React, { useEffect");
}

fs.writeFileSync(file, content);
console.log('Success');
