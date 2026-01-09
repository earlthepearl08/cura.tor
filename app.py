import streamlit as st
import math

# Page configuration
st.set_page_config(
    page_title="Solar Feasibility & Requirement Tool",
    page_icon="☀️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Premium Custom CSS
st.markdown("""
    <style>
    /* Main background */
    .stApp {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #f8fafc;
    }
    
    /* Sidebar styling */
    section[data-testid="stSidebar"] {
        background-color: rgba(30, 41, 59, 0.7);
        backdrop-filter: blur(10px);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Metric cards */
    [data-testid="stMetricValue"] {
        color: #fbbf24;
        font-weight: 700;
    }
    
    [data-testid="stMetricLabel"] {
        color: #94a3b8;
    }
    
    .metric-card {
        background: rgba(255, 255, 255, 0.05);
        padding: 20px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
        transition: transform 0.3s ease;
    }
    
    .metric-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.08);
        border-color: #fbbf24;
    }

    /* Savings section highlighting */
    .savings-box {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);
        padding: 24px;
        border-radius: 16px;
        margin: 10px 0;
    }

    /* Footer styling */
    .footer {
        margin-top: 50px;
        padding: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
        color: #94a3b8;
    }
    
    .footer a {
        color: #fbbf24;
        text-decoration: none;
        font-weight: bold;
    }
    
    .footer a:hover {
        text-decoration: underline;
    }
    
    /* Headings */
    h1, h2, h3 {
        color: #f8fafc !important;
        font-family: 'Inter', sans-serif;
    }
    
    .stWarning {
        background-color: rgba(245, 158, 11, 0.2) !important;
        border-color: #f59e0b !important;
        color: #fbbf24 !important;
    }

    .info-tag {
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8em;
        font-weight: bold;
        display: inline-block;
        margin-bottom: 10px;
    }
    </style>
    """, unsafe_allow_html=True)

# Sidebar Inputs
st.sidebar.header("📋 System Inputs")

project_scale = st.sidebar.selectbox(
    "Project Scale",
    ["Residential", "C&I", "Utility Scale"],
    help="Residential (up to 20kWp), C&I (21-300kWp), Utility (>300kWp)"
)

bill = st.sidebar.number_input(
    "Average Meralco Bill (PHP)", 
    min_value=0.0, 
    max_value=100000000.0, 
    value=5000.0 if project_scale == "Residential" else (50000.0 if project_scale == "C&I" else 1000000.0), 
    step=500.0,
    help="Your average monthly electricity spending."
)

rate = st.sidebar.number_input(
    "Meralco Rate per kWh (PHP)", 
    min_value=1.0, 
    max_value=50.0, 
    value=12.5, 
    step=0.1
)

solar_target_pct = st.sidebar.slider(
    "Expected Solar Consumption %", 
    min_value=0, 
    max_value=100, 
    value=100,
    help="Goal percentage of total power to be supplied by solar."
)

available_area = st.sidebar.number_input(
    "Available Roof/Land Area (sqm)", 
    min_value=0.0, 
    value=50.0 if project_scale == "Residential" else (1000.0 if project_scale == "C&I" else 10000.0), 
    step=5.0
)

module_wattage = st.sidebar.number_input(
    "PV Module Wattage (Wp)", 
    min_value=100, 
    max_value=800, 
    value=550, 
    step=10
)

# Fixed Panel Size
PANEL_SIZE_SQM = 3.0
st.sidebar.info(f"Panel Size: {PANEL_SIZE_SQM} sqm (Includes spacing & installation constraints)")

system_type = st.sidebar.selectbox(
    "System Type", 
    ["Grid-Tied", "Hybrid", "Off-Grid"]
)

# Battery Settings
if system_type in ["Hybrid", "Off-Grid"]:
    st.sidebar.markdown("---")
    st.sidebar.subheader("🔋 Battery Configuration")
    
    backup_hours = st.sidebar.slider("Backup Duration (Hours)", 1, 24, 4)
    
    # Scale-based battery options
    if project_scale == "Residential":
        battery_options = {"5kWh": 5, "10kWh": 10, "15kWh": 15}
    elif project_scale == "C&I":
        battery_options = {"15kWh": 15, "100kWh": 100, "215kWh": 215, "1MWh": 1000}
    else: # Utility
        battery_options = {"215kWh": 215, "1MWh": 1000}
    
    # User selects a battery size from the available list
    battery_label = st.sidebar.selectbox("Battery Unit Size", list(battery_options.keys()), index=len(battery_options)-1)
    battery_capacity_kwh = battery_options[battery_label]

# Core Logic Constants
PSH = 4.0 # Peak Sun Hours
EFFICIENCY = 0.80

# Calculations
# 1. Total Monthly kWh
monthly_kwh = bill / rate
daily_kwh = monthly_kwh / 30

# 2. Daily Goal
target_daily_solar_kwh = daily_kwh * (solar_target_pct / 100)

# 3. Required Capacity (kWp)
required_kwp = target_daily_solar_kwh / (PSH * EFFICIENCY)

# 4. Number of Panels (Always even, rounded down)
raw_panels_required = math.ceil((required_kwp * 1000) / module_wattage)
num_panels_required = (raw_panels_required // 2) * 2

# 5. Total Area Needed
total_area_needed = num_panels_required * PANEL_SIZE_SQM

# 6. Total PV Possible based on Area (Always even, rounded down)
raw_panels_possible = math.floor(available_area / PANEL_SIZE_SQM)
total_panels_possible = (raw_panels_possible // 2) * 2
possible_kwp = (total_panels_possible * module_wattage) / 1000

# 7. Final Metrics to Display (Cap at possible capacity)
display_panels = min(num_panels_required, total_panels_possible)
display_kwp = (display_panels * module_wattage) / 1000
display_area = display_panels * PANEL_SIZE_SQM

# 8. Actual Feasible Production
effective_daily_solar_kwh = display_kwp * PSH * EFFICIENCY
max_possible_offset = min(100.0, ((possible_kwp * PSH * EFFICIENCY) / daily_kwh * 100) if daily_kwh > 0 else 0)

# Scale Validation and Categorization
actual_category = ""
if display_kwp <= 20:
    actual_category = "Residential"
elif 20 < display_kwp <= 300:
    actual_category = "C&I"
else:
    actual_category = "Utility Scale"

# Main Screen Layout
st.title("☀️ Solar Feasibility & Requirement Tool")
st.markdown(f'<div class="info-tag">{project_scale} Project</div>', unsafe_allow_html=True)
st.markdown("---")

# Scale Warning
if project_scale != actual_category:
    st.info(f"💡 Based on your bill, this system is sized as **{actual_category}** ({display_kwp:.1f} kWp), though you selected **{project_scale}**.")

# Area Check Warning
# Use a higher threshold for "insufficient" to avoid noise, or strictly follow Required > Available
if num_panels_required > total_panels_possible:
    st.warning(f"⚠️ **Space Insufficient for this target.**\n\nYour available area ({available_area} sqm) can only accommodate {total_panels_possible} panels. Maximum possible offset with current space is **{max_possible_offset:.1f}%**.")

# High-Level Metrics
col1, col2, col3 = st.columns(3)

with col1:
    st.metric("System Capacity", f"{display_kwp:.2f} kWp")

with col2:
    st.metric("Number of Panels", f"{display_panels}")

with col3:
    st.metric("Total Area Used", f"{display_area:.1f} m²")

st.markdown("### 💰 Savings & Offset")

# Savings Calculation (Based on effective solar production)
# In kWh
monthly_savings_kwh = effective_daily_solar_kwh * 30
yearly_savings_kwh = monthly_savings_kwh * 12

# In PHP
monthly_savings_php = monthly_savings_kwh * rate
yearly_savings_php = yearly_savings_kwh * rate

col_a, col_b = st.columns(2)

with col_a:
    st.markdown("""
        <div class="savings-box">
            <h4>Monthly Savings</h4>
            <h2 style='color:#22c55e;'>₱ {:,.2f}</h2>
            <p style='color:#94a3b8;'>({:,.1f} kWh / month)</p>
        </div>
    """.format(monthly_savings_php, monthly_savings_kwh), unsafe_allow_html=True)

with col_b:
    st.markdown("""
        <div class="savings-box">
            <h4>Yearly Savings</h4>
            <h2 style='color:#22c55e;'>₱ {:,.2f}</h2>
            <p style='color:#94a3b8;'>({:,.1f} kWh / year)</p>
        </div>
    """.format(yearly_savings_php, yearly_savings_kwh), unsafe_allow_html=True)

# Battery Logic
if system_type in ["Hybrid", "Off-Grid"]:
    st.markdown("---")
    st.markdown("### 🔋 Battery Storage Requirement")
    
    # Requirement = Avg Hourly Load * Backup Hours
    avg_hourly_load = (bill / rate / 30 / 24)
    storage_needed_kwh = avg_hourly_load * backup_hours
    
    num_batteries = math.ceil(storage_needed_kwh / battery_capacity_kwh)
    
    bcol1, bcol2 = st.columns([1, 2])
    with bcol1:
        st.metric(f"{battery_label} Batteries", f"{num_batteries}")
    with bcol2:
        st.info(f"Targeting **{backup_hours} hours** of backup. Total storage needed: **{storage_needed_kwh:.1f} kWh**. Using **{num_batteries}x {battery_label}** units.")

# Footer Section
st.markdown("""
    <div class="footer">
        <h3>📞 Contact Us</h3>
        <p>For professional installation and detailed assessments:</p>
        <p><strong>Display Name:</strong> Earl Dy</p>
        <p><strong>Phone:</strong> <a href="tel:09687269310" target="_blank">09687269310</a></p>
    </div>
    """, unsafe_allow_html=True)
