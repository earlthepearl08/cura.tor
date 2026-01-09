import streamlit as st
import math

# Page configuration
st.set_page_config(
    page_title="Solar Feasibility and Requirement Tool",
    page_icon="lightning_bolt",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Premium Custom CSS
st.markdown("""
    <style>
    /* Main background */
    .stApp {
        background: #f8fafc;
        color: #1e293b;
    }
    
    /* Sidebar styling */
    section[data-testid="stSidebar"] {
        background-color: #002B5B !important;
        color: white !important;
    }
    
    section[data-testid="stSidebar"] .stMarkdown, section[data-testid="stSidebar"] .stText {
        color: white !important;
    }

    section[data-testid="stSidebar"] label {
        color: white !important;
    }
    
    section[data-testid="stSidebar"] [data-testid="stHeader"] {
        background-color: rgba(0,0,0,0) !important;
    }

    /* Sidebar Headers to White */
    section[data-testid="stSidebar"] h1, 
    section[data-testid="stSidebar"] h2, 
    section[data-testid="stSidebar"] h3,
    section[data-testid="stSidebar"] h4 {
        color: white !important;
    }
    
    /* Sidebar Input Styling - Direct overrides for Streamlit Cloud */
    [data-testid="stSidebar"] [data-testid="stWidgetLabel"] p {
        color: white !important;
    }

    /* Force white background and black text for ALL sidebar inputs */
    [data-testid="stSidebar"] [data-baseweb="input"],
    [data-testid="stSidebar"] [data-baseweb="select"] > div,
    [data-testid="stSidebar"] [data-baseweb="select"] {
        background-color: white !important;
        color: black !important;
        border-radius: 8px !important;
    }

    /* Ensure the actual input text is black */
    [data-testid="stSidebar"] input {
        color: black !important;
        background-color: white !important;
        -webkit-text-fill-color: black !important;
    }

    /* Fix the Selectbox dropdown and text */
    [data-testid="stSidebar"] [data-baseweb="select"] * {
        color: black !important;
    }

    /* Style the +/- buttons in number input */
    [data-testid="stSidebar"] [data-testid="stNumberInput"] button {
        background-color: white !important;
        color: black !important;
        border: 1px solid #e2e8f0 !important;
    }
    
    [data-testid="stSidebar"] [data-testid="stNumberInput"] button:hover {
        background-color: #f8fafc !important;
    }

    /* Logo Seamless Circular integration */
    [data-testid="stSidebar"] [data-testid="stImage"] img {
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        background-color: transparent !important;
    }
    
    /* Metric cards */
    [data-testid="stMetricValue"] {
        color: #002B5B;
        font-weight: 700;
    }
    
    [data-testid="stMetricLabel"] {
        color: #64748b;
    }
    
    /* Savings box styling */
    .savings-box {
        background: #fefce8;
        border: 1px solid #fef08a;
        padding: 24px;
        border-radius: 16px;
        margin: 10px 0;
    }

    /* Footer styling - Black font */
    .footer {
        margin-top: 50px;
        padding: 40px;
        border-top: 1px solid #e2e8f0;
        text-align: center;
        color: #000000 !important;
        background: #f1f5f9;
        border-radius: 0 0 16px 16px;
    }
    
    .footer h3, .footer p, .footer strong {
        color: #000000 !important;
    }
    
    .footer a {
        color: #002B5B;
        text-decoration: none;
        font-weight: bold;
    }
    
    .footer a:hover {
        text-decoration: underline;
    }
    
    h1, h2, h3, h4 {
        color: #0f172a !important;
        font-family: 'Inter', sans-serif;
    }
    
    .stWarning, .stAlert, [data-testid="stNotificationContent"] {
        background-color: #fffbeb !important;
        border-color: #facc15 !important;
        color: #000000 !important;
    }

    /* Target all text inside alerts to be black */
    .stAlert p, .stAlert div, .stAlert span, .stAlert h1, .stAlert h2, .stAlert h3 {
        color: #000000 !important;
    }

    .info-tag {
        background: #002B5B;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8em;
        font-weight: bold;
        display: inline-block;
        margin-bottom: 20px;
    }

    /* Hide specific UI elements while keeping sidebar toggle */
    header[data-testid="stHeader"] {
        background: transparent !important;
    }
    button[data-testid="baseButton-header"] {
        display: none !important;
    }
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    [data-testid="stDeployButton"] {display: none;}
    </style>
    """, unsafe_allow_html=True)

# Sidebar Inputs
st.sidebar.image("logo.png", width="stretch")
st.sidebar.header("System Inputs")

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
    step=500.0
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
    value=100
)

available_area = st.sidebar.number_input(
    "Available Roof/Land Area (sqm)", 
    min_value=0.0, 
    value=50.0 if project_scale == "Residential" else (1000.0 if project_scale == "C&I" else 10000.0), 
    step=5.0
)

module_wattage = st.sidebar.number_input("PV Module Wattage (Wp)", min_value=100, max_value=800, value=550, step=10)

# Fixed Panel Size
# 3sqm is used to allot for spacing and other installation constraints.
PANEL_SIZE_SQM = 3.0
st.sidebar.info(f"Panel Size: {PANEL_SIZE_SQM} sqm (Includes spacing and installation constraints)")

system_type = st.sidebar.selectbox("System Type", ["Grid-Tied", "Hybrid", "Off-Grid"])

# Battery Configuration Settings
st.sidebar.markdown("---")
st.sidebar.subheader("Battery Configuration")

if system_type in ["Hybrid", "Off-Grid"]:
    backup_hours = st.sidebar.slider("Backup Duration (Hours)", 1, 24, 4)
else:
    backup_hours = 0 # Not applicable for standard on-grid logic unless we use the 'Reach Goal' logic

# Scale-based defaults and load profile
if project_scale == "Residential":
    battery_options = {"5kWh": 5, "10kWh": 10, "15kWh": 15}
    default_daytime_pct = 30
elif project_scale == "C&I":
    battery_options = {"15kWh": 15, "100kWh": 100, "215kWh": 215, "1MWh": 1000}
    default_daytime_pct = 70
else: # Utility
    battery_options = {"215kWh": 215, "1MWh": 1000}
    default_daytime_pct = 10

daytime_load_pct = st.sidebar.slider(
    "Daytime Load Split %",
    0, 100, default_daytime_pct,
    help="Percentage of your daily electricity consumption that occurs during sun hours (approx 8am-4pm)."
)
direct_cons_rate = daytime_load_pct / 100

selected_battery_label = st.sidebar.selectbox("Battery Unit Size", list(battery_options.keys()), index=len(battery_options)-1)
battery_unit_kwh = battery_options[selected_battery_label]

# Core Logic Constants
PSH = 4.0 # Peak Sun Hours
EFFICIENCY = 0.80

# Calculations
monthly_kwh = bill / rate
daily_kwh = monthly_kwh / 30
target_daily_solar_kwh = daily_kwh * (solar_target_pct / 100)

required_kwp = target_daily_solar_kwh / (PSH * EFFICIENCY)

# Even Panel counts (rounding down)
raw_panels_req = math.ceil((required_kwp * 1000) / module_wattage)
num_panels_required = (raw_panels_req // 2) * 2

raw_panels_poss = math.floor(available_area / PANEL_SIZE_SQM)
total_panels_possible = (raw_panels_poss // 2) * 2
possible_kwp = (total_panels_possible * module_wattage) / 1000

# Final Metrics (Cap at possible)
display_panels = min(num_panels_required, total_panels_possible)
display_kwp = (display_panels * module_wattage) / 1000
display_area = display_panels * PANEL_SIZE_SQM

# Resulting production
effective_daily_solar_kwh = display_kwp * PSH * EFFICIENCY
max_possible_offset = min(100.0, ((possible_kwp * PSH * EFFICIENCY) / daily_kwh * 100) if daily_kwh > 0 else 0)

# Scale Suggestion
actual_category = ""
if display_kwp <= 20: actual_category = "Residential"
elif 20 < display_kwp <= 300: actual_category = "C&I"
else: actual_category = "Utility Scale"

# Main Screen
st.title("Solar Feasibility and Requirement Tool")
st.markdown(f'<div class="info-tag">{project_scale} Project</div>', unsafe_allow_html=True)
st.markdown("---")

if project_scale != actual_category:
    st.info(f"Note: System sized as **{actual_category}** ({display_kwp:.1f} kWp). Consider aligning Project Scale for optimized battery options.")

if num_panels_required > total_panels_possible:
    st.warning(f"Warning: Space insufficient for {solar_target_pct}% target. Available area ({available_area}m²) limits system to {total_panels_possible} panels ({max_possible_offset:.1f}% offset).")

# Metrics
col1, col2, col3 = st.columns(3)
with col1: st.metric("System Capacity", f"{display_kwp:.2f} kWp")
with col2: st.metric("Number of Panels", f"{display_panels}")
with col3: st.metric("Total Area Used", f"{display_area:.1f} m²")

st.markdown("### Savings and Offset")
monthly_savings_kwh = effective_daily_solar_kwh * 30
monthly_savings_php = monthly_savings_kwh * rate
yearly_savings_php = monthly_savings_php * 12

cola, colb = st.columns(2)
with cola:
    st.markdown(f'<div class="savings-box"><h4>Monthly Savings</h4><h2 style="color:#22c55e;">₱ {monthly_savings_php:,.2f}</h2><p style="color:#64748b;">({monthly_savings_kwh:,.1f} kWh/month history)</p></div>', unsafe_allow_html=True)
with colb:
    st.markdown(f'<div class="savings-box"><h4>Yearly Savings</h4><h2 style="color:#22c55e;">₱ {yearly_savings_php:,.2f}</h2><p style="color:#64748b;">({monthly_savings_kwh*12:,.1f} kWh/year history)</p></div>', unsafe_allow_html=True)

# Battery Assessment
st.markdown("---")
st.markdown("### Battery Storage Assessment")

if system_type == "Grid-Tied":
    # On-grid logic: suggested battery to reach the target energy consumption
    # Households/C&I usually can't self-consume 100% of solar production instantly.
    
    # Calculate how much of the energy produced can be consumed instantly
    # We compare the produced Solar Energy vs the Daytime Load
    daytime_kwh_load = daily_kwh * direct_cons_rate
    
    # Direct consumption is the minimum of what we produce and what we need at that moment
    direct_cons_kwh = min(effective_daily_solar_kwh, daytime_kwh_load)
    storage_gap_kwh = effective_daily_solar_kwh - direct_cons_kwh
    
    # Assessment UI
    st.write(f"**Self-Consumption Assessment:** Given your **{daytime_load_pct}%** daytime load split, we estimate you will directly consume **{direct_cons_kwh:.1f} kWh** of solar energy daily.")
    
    if storage_gap_kwh > 0:
        st.write(f"To reach your **{solar_target_pct}%** target without exporting surplus to the grid, a battery solution is recommended for the **{storage_gap_kwh:.1f} kWh** sunset gap.")
        
        num_batt_suggested = math.ceil(storage_gap_kwh / battery_unit_kwh)
        
        bcol1, bcol2 = st.columns([1, 2])
        with bcol1:
            st.metric(f"Suggested {selected_battery_label} Units", f"{num_batt_suggested}")
        with bcol2:
            st.info(f"Adding **{num_batt_suggested}x {selected_battery_label}** units enables maximum self-consumption and peak shaving.")
    else:
        st.success("Your daytime load is high enough to consume all solar production directly! No battery storage is required for your current target.")

else: # Hybrid or Off-Grid
    # Requirement = Backup hours logic
    avg_hourly_load = daily_kwh / 24
    storage_needed_kwh = avg_hourly_load * backup_hours
    num_batt = math.ceil(storage_needed_kwh / battery_unit_kwh)
    
    bcol1, bcol2 = st.columns([1, 2])
    with bcol1:
        st.metric(f"Required {selected_battery_label} Units", f"{num_batt}")
    with bcol2:
        st.info(f"Targeting **{backup_hours} hours** of backup. Total storage needed: **{storage_needed_kwh:.1f} kWh**.")

# Footer
st.markdown(f"""
    <div class="footer">
        <h3>Contact Us</h3>
        <p>For professional installation and detailed assessments:</p>
        <p><strong>Earl Dy</strong></p>
        <p>09687269310 | <a href="mailto:earldy.kpwunibest@gmail.com">earldy.kpwunibest@gmail.com</a></p>
    </div>
    """, unsafe_allow_html=True)
