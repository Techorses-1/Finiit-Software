import React, { useEffect, useState } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FiShoppingCart,
  FiTruck,
  FiPackage,
  FiDollarSign,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import "./Home.css";

const Home = () => {
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [bomData, setBomData] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);




   useEffect(() => {
      window.scrollTo(0, 0);
    }, []);


    

  // Enhanced data processing with proper date handling
  const processChartData = (data, type) => {
    console.log(`Processing ${type} data:`, data);
    if (!Array.isArray(data)) {
      console.error(`Expected array for ${type} data, got:`, typeof data);
      return [];
    }

    const dateField = type === "sales" ? "invoiceDate" : "grnDate";
    const valueField = "total";

    // Group by month for better visualization
    const monthlyData = data.reduce((acc, item) => {
      if (!item[dateField]) {
        console.warn(`Missing date field in ${type} item:`, item);
        return acc;
      }

      const date = new Date(item[dateField]);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!acc[monthYear]) {
        acc[monthYear] = { date: monthYear, value: 0, count: 0 };
      }
      acc[monthYear].value += item[valueField] || 0;
      acc[monthYear].count += 1;
      return acc;
    }, {});

    return Object.values(monthlyData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6); // Last 6 months
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Starting data fetch...");

        const urls = [
          `${import.meta.env.VITE_API_URL}/sales/get-sales`,
          `${import.meta.env.VITE_API_URL}/grn/get-grns`,
          `${import.meta.env.VITE_API_URL}/inventory/get-inventory`,
          `${import.meta.env.VITE_API_URL}/bom/get-boms`,
          `${import.meta.env.VITE_API_URL}/workorder/get-workorders`,
          `${import.meta.env.VITE_API_URL}/po/get-pos`
        ];

        const responses = await Promise.all(urls.map(url =>
          fetch(url).then(res => res.json())
        ));

        // Extract data property from each response
        const [sales, purchases, inventory, bom, workOrders, pos] = responses.map(
          res => res.success ? res.data : []
        );

        console.log("Extracted data:", {
          sales: sales.length,
          purchases: purchases.length,
          inventory: inventory.length,
          bom: bom.length,
          workOrders: workOrders.length,
          purchaseOrders: pos.length
        });

        setSalesData(Array.isArray(sales) ? sales : []);
        setPurchaseData(Array.isArray(purchases) ? purchases : []);
        setInventoryData(Array.isArray(inventory) ? inventory : []);
        setBomData(Array.isArray(bom) ? bom : []);
        setWorkOrders(Array.isArray(workOrders) ? workOrders : []);
        setPurchaseOrders(Array.isArray(pos) ? pos : []);

      } catch (error) {
        console.error("Error in fetchData:", error);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Find work orders without sales
  // const pendingWorkOrders = workOrders.filter(wo => {
  //   return !salesData.some(sale => sale.poNumber === wo.poNumber);
  // });

  const pendingWorkOrders = workOrders.filter(wo => {
    return !salesData.some(sale => sale.workOrderNumber === wo.workOrderNumber);
  });

  // Find POs without GRNs
  const pendingGRNs = purchaseOrders.filter(po => {
    return !purchaseData.some(grn => grn.poNumber === po.poNumber);
  });

  // Inventory status
  const inventoryStatus = inventoryData.reduce(
    (acc, item) => {
      if (item.currentStock <= 0) acc.outOfStock++;
      else if (item.currentStock <= (item.minimumQty || 0)) acc.lowStock++;
      else acc.inStock++;
      return acc;
    },
    { inStock: 0, lowStock: 0, outOfStock: 0 }
  );

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div>
      <Navbar>
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Inventory Dashboard</h1>
            <p>Overview of your operations</p>
          </div>


          {/* Inventory Alerts */}
          <div className="inventory-alerts">
            <h3>Inventory Alerts</h3>
            <div className="alert-grid">
              <div className="alert-section">
                <h4>
                  <FiAlertTriangle className="icon-warning" /> Low Stock
                </h4>
                <ul>
                  {inventoryData
                    .filter(item => item.currentStock > 0 && item.currentStock <= item.minimumQty)
                    .slice(0, 5)
                    .map(item => (
                      <li key={item.inventoryId}>
                        {item.itemName} - {item.currentStock} left (min: {item.minimumQty})
                      </li>
                    ))}
                  {inventoryData.filter(item => item.currentStock > 0 && item.currentStock <= item.minimumQty).length === 0 && (
                    <li>No low stock items</li>
                  )}
                </ul>
              </div>

              <div className="alert-section">
                <h4>
                  <FiAlertTriangle className="icon-danger" /> Out of Stock
                </h4>
                <ul>
                  {inventoryData
                    .filter(item => item.currentStock <= 0)
                    .slice(0, 5)
                    .map(item => (
                      <li key={item.inventoryId}>{item.itemName}</li>
                    ))}
                  {inventoryData.filter(item => item.currentStock <= 0).length === 0 && (
                    <li>No out of stock items</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          

          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <FiDollarSign className="metric-icon sales" />
              <div>
                <h3>Total Sales</h3>
                <p>
                  ₹{salesData.reduce((sum, sale) => sum + (sale?.total || 0), 0).toLocaleString()}
                </p>
                <small>{salesData.length} invoices</small>
              </div>
            </div>

            <div className="metric-card">
              <FiShoppingCart className="metric-icon purchases" />
              <div>
                <h3>Total Purchases</h3>
                <p>
                  ₹{purchaseData.reduce((sum, purchase) => sum + (purchase?.total || 0), 0).toLocaleString()}
                </p>
                <small>{purchaseData.length} GRNs</small>
              </div>
            </div>

            <div className="metric-card">
              <FiPackage className="metric-icon inventory" />
              <div>
                <h3>Inventory Status</h3>
                <p>{inventoryData.length} items</p>
                <small>
                  {inventoryStatus.lowStock} low stock, {inventoryStatus.outOfStock} out stock
                </small>
              </div>
            </div>

            <div className="metric-card">
              <FiTruck className="metric-icon production" />
              <div>
                <h3>Work Orders</h3>
                <p>{workOrders.length} total</p>
                <small>
                  {pendingWorkOrders.length} pending sales
                </small>
              </div>
            </div>
          </div>


          {/* Pending Actions Section */}
          <div className="pending-actions">
            <div className="pending-section">
              <h3><FiClock /> Pending Work Orders</h3>
              <div className="pending-list">
                {pendingWorkOrders.slice(0, 5).map(wo => (
                  <div key={wo.workOrderNumber} className="pending-item">
                    <p>WO #{wo.workOrderNumber}</p>
                    <small>
                      {wo.workOrderDate} • {wo.items?.length || 0} items
                    </small>
                  </div>
                ))}
                {pendingWorkOrders.length === 0 && (
                  <div className="no-pending">All work orders have sales</div>
                )}
              </div>
            </div>

            <div className="pending-section">
              <h3><FiClock /> Pending GRNs</h3>
              <div className="pending-list">
                {pendingGRNs.slice(0, 5).map(po => (
                  <div key={po.poNumber} className="pending-item">
                    <p>PO #{po.poNumber}</p>
                    <small>
                      {po.date} • Vendor: {po.vendorName}
                    </small>
                  </div>
                ))}
                {pendingGRNs.length === 0 && (
                  <div className="no-pending">All POs have GRNs</div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Sales Trend (Last 6 Months)</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color sales"></div>
                    <span>Sales (₹)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={processChartData(salesData, "sales")}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.split('-')[1]} // Show only month number
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${value / 1000}k`} // Format as thousands
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Sales"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 8, stroke: '#8884d8', strokeWidth: 2 }}
                    name="Sales"
                  />
                  <ReferenceLine y={0} stroke="#ccc" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Purchase Trend (Last 6 Months)</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color purchases"></div>
                    <span>Purchases (₹)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={processChartData(purchaseData, "purchase")}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.split('-')[1]} // Show only month number
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${value / 1000}k`} // Format as thousands
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Purchases"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar
                    dataKey="value"
                    fill="#82ca9d"
                    radius={[4, 4, 0, 0]}
                    name="Purchases"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>




        </div>
      </Navbar>
    </div>
  );
};

export default Home;