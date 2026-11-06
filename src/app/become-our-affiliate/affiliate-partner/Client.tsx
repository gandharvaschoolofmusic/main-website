"use client";
import { countryOptions } from "@/Data/CountryCode";
import React, { useState } from "react";
import Select from "react-select";

const initialFormState = {
  name: "",
  email: "",
  countryCode: { value: "+91", label: "India (+91)" },
  phone: "",
  message: "",
};

export default function AffiliatePartner() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [warning, setWarning] = useState({
    name: false,
    email: false,
    phone: false,
    message: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  type CountryOption = { value: string; label: string };

  // @typescript-eslint/no-explicit-any Improove
  const handleCountryChange = (selectedOption: CountryOption | null) => {
    if (selectedOption)
      setFormData({ ...formData, countryCode: selectedOption });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // console.log("Form submitted:", {
    //   ...formData,
    //   countryCode: formData.countryCode.value,
    // });
    const localWarning = {
      name: false,
      email: false,
      phone: false,
      message: false,
    };
    let hasAwarning = false;
    if (formData.name === initialFormState.name) {
      hasAwarning = true;
      localWarning.name = true;
    }
    if (formData.email === initialFormState.email) {
      hasAwarning = true;
      localWarning.email = true;
    }
    if (formData.phone === initialFormState.phone) {
      hasAwarning = true;
      localWarning.phone = true;
    }
    if (formData.message === initialFormState.message) {
      hasAwarning = true;
      localWarning.message = true;
    }

    if (hasAwarning) {
      setWarning((prev) => ({ ...prev, ...localWarning }));
      return;
    }

    let userIP = "client";
    try {
      const ipResponse = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2500) });
      if (ipResponse.ok) {
        const ipData = await ipResponse.json();
        userIP = ipData.ip || "client";
      }
    } catch {
      // Non-blocking fallback
    }
    const data = {
      ...formData,
      activeSheet: "Affiliate",
      name: formData.name,
      email: formData.email,
      message: formData.message,
      phone: `${formData.countryCode.value}-${formData.phone}`,
      userIP,
    };

    try {
      // Sending data to Google Apps Script endpoint
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbySJzE7ICyLe7PubP04AOdVRKpCt9DeqV6v3xeelfjvMRf95KIwIqBsUCvTw1_4yeWyCw/exec",
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
          body: JSON.stringify(data),
        }
      );

      // Parsing the response
      const result = await response.json();
      console.log(result);

      // If submission is successful, reset the form
      if (response.ok) {
        //  console.log("Form submitted successfully!");

        // Reset the form data
        setFormData(initialFormState);
        setWarning({
          name: false,
          email: false,
          phone: false,
          message: false,
        });
      } else {
        console.error("Failed to submit the form.");
      }
    } catch (error) {
      console.error("Error during form submission:", error);
    }
    setSubmitted(true);
  };

  return (
    <div>
      <section className="bg-[url(/teach-us-2.avif)] w-full h-[60vh] md:h-[90vh] bg-no-repeat bg-top bg-cover flex flex-col items-center justify-center py-10 px-4">
        <div className="md:px-[10%] py-5 md:p-[10%] px-1">
          <h1
            className="text-[32px] w-full md:w-1/2 text-left md:text-[64px] text-white mb-6 mt-12 md:mt-28"
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            Earn a <strong style={{ fontWeight: 700 }}>Flat 25%</strong>{" "}
            commission on every successful referral
          </h1>
        </div>
      </section>
      <section className="px-4 md:px-[10%] py-5 md:py-[10%]">
        <h2
          className="text-[20px]  md:text-[30px] text-[#7A7A7A] text-left"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}
        >
          You Are Applying For
        </h2>
        <h2
          className="text-[28px]  md:text-[48px] text-[#1A022D] text-left mt-2"
          style={{
            fontFamily: "var(--font-vidaloka)",
            fontWeight: 500,
          }}
        >
          Gandharva&apos;s Affiliate Partner
        </h2>
        <form
          onSubmit={handleSubmit}
          className="mt-8"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
        >
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-[16px] md:text-[16px] font-medium text-[#2B2730]"
            >
              Full Name <sup className="text-red-500">*</sup>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="border border-gray-300 rounded-sm p-2 mt-1 w-full focus:outline-none focus:ring-[#8506D5] focus:ring-2 transition-all duration-300"
            />
            {warning.name && <WarningMsg message="This field is required" />}
          </div>

          <div className="mb-4">
            <label
              htmlFor="phone"
              className="block text-[16px] md:text-[16px] font-medium text-[#2B2730]"
            >
              WhatsApp Number <sup className="text-red-500">*</sup>
            </label>
            <p className="text-[12px] text-[#2B2730B3] my-1">
              You&apos;ll receive your Unique Referral Code and other marketing
              materials over WhatsApp.
            </p>
            <div className="flex items-center border border-gray-300 rounded-sm focus-within:ring-[#8506D5] focus-within:ring-2 transition-all duration-300">
              <div className="relative">
                <Select
                  instanceId="affiliate-country-code"
                  id="countryCode"
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleCountryChange}
                  options={countryOptions}
                  placeholder=""
                  styles={{
                    control: (base) => ({
                      ...base,
                      border: "none",
                      boxShadow: "none",
                      padding: "0",
                      minWidth: "150px",
                      cursor: "pointer",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0",
                      justifyContent: "center",
                    }),
                    dropdownIndicator: (base, state) => ({
                      ...base,
                      transform: state.selectProps.menuIsOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 10,
                      width: "auto",
                    }),
                  }}
                  components={{
                    IndicatorSeparator: () => null,
                  }}
                  getOptionLabel={(e) => `${e.label}`}
                />
              </div>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter your WhatsApp Number"
                className="flex-1 p-2 focus:outline-none"
              />
            </div>
            {warning.phone && <WarningMsg message="This field is required" />}
          </div>

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-[16px] md:text-[16px] font-medium text-[#2B2730]"
            >
              Email Id <sup className="text-red-500">*</sup>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@mail.com"
              className="border border-gray-300 rounded-sm p-2 mt-1 w-full focus:outline-none focus:ring-[#8506D5] focus:ring-2 transition-all duration-300"
            />
            {warning.email && <WarningMsg message="This field is required" />}
          </div>

          <div className="mb-4">
            <label
              htmlFor="message"
              className="block text-[16px] md:text-[16px] font-medium text-[#2B2730]"
            >
              How are you planning to promote Gandharva?{" "}
              <sup className="text-red-500">*</sup>
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              value={formData.message}
              onChange={handleChange}
              placeholder="Be as descriptive as possible. This will let us verify & approve you better."
              className="border border-gray-300 rounded-sm p-2 mt-1 w-full focus:outline-none focus:ring-[#8506D5] focus:ring-2 transition-all duration-300"
            />
            {warning.message && <WarningMsg message="This field is required" />}
          </div>

          <button
            type="submit"
            aria-label="submit"
            className="bg-[#9506EE] text-white py-2 px-4 rounded-md hover:bg-purple-900 focus:outline-none focus:ring-[#8506D5] focus:ring-2 transition-all duration-300"
          >
            Submit
          </button>
        </form>
        {submitted && (
          <p className="mt-4 text-green-600 text-center md:text-left">
            Thank you for applying! We&apos;ll get back to you soon.
          </p>
        )}
      </section>
    </div>
  );
}

function WarningMsg({ message }: { message: string }) {
  return (
    <div className="w-full text-red-900 text-xs rounded-lg bg-red-100 p-3 mt-2">
      {message}
    </div>
  );
}
