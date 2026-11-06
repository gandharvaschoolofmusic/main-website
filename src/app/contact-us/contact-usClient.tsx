"use client";
import Select from "react-select";
import { IoMdMail } from "react-icons/io";
import { RiCustomerService2Fill } from "react-icons/ri";
import { countryOptions } from "@/Data/CountryCode";
import { useState } from "react";
import Modal from "@/components/Modal";

export default function ContactUsClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedCode, setSelectedCode] = useState("+91");
  const [warning, setWarning] = useState({
    name: false,
    mail: false,
    phone: false,
  });
  type CountryOption = { value: string; label: string };
  const handleCountryChange = (selectedOption: CountryOption | null) => {
    if (selectedOption) {
      setSelectedCode(selectedOption.value);
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChange = (_event: React.ChangeEvent<HTMLInputElement>) => {
    // Intentionally left empty or will be implemented later
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevents the default form submission behavior

    // Collect form data
    const formData = new FormData(event.target as HTMLFormElement);

    // Extract individual fields from form data
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    //const countryCode = formData.get("countryCode") as string;
    const message = formData.get("message") as string;

    // Log the collected data (you can replace this with your API call)
    // console.log("Form Submitted!");
    // console.log("Name:", name);
    // console.log("Email:", email);
    // console.log("Phone:", phone);
    // console.log("Message:", message);
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
      activeSheet: "Contact__Us",
      name: name,
      mail: email,
      phone: `${selectedCode}-${phone}`,
      message: message,
      userIP: userIP,
    };

    const localWarning = {
      name: false,
      mail: false,
      phone: false,
    };

    let hasAwarning = false;
    if (data.name === "" || data.name === null || data.name === undefined) {
      hasAwarning = true;
      localWarning.name = true;
    }
    if (data.mail === "" || data.mail === null || data.mail === undefined) {
      hasAwarning = true;
      localWarning.mail = true;
    }
    if (data.phone === "" || data.phone === null || data.phone === undefined) {
      hasAwarning = true;
      localWarning.phone = true;
    }

    if (hasAwarning) {
      setWarning((prev) => ({ ...prev, ...localWarning }));
      return;
    }

    try {
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
      //   const result = await response.json();
      //console.log(result);
      if (response.ok) {
        setModalMessage("Your message has been sent successfully!");
        setModalOpen(true);
        const formElement = event.target as HTMLFormElement;
        formElement.reset();
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setModalMessage("Oops! Something went wrong. Please try again later.");
      setModalOpen(true);
    }
    // Optionally, you can reset the form after submission

    // Optionally, show a success message or redirect
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <div>
      <section className="bg-[url(/DCFVNN.avif)] w-full h-[50vh] md:h-[90vh] bg-no-repeat bg-top bg-cover flex flex-col items-start justify-center py-10 px-4">
        <div className="md:px-[10%] py-5 md:p-[10%] px-1 md:w-[55%]">
          <h1
            className="text-[26px] w-full text-left md:text-[52px] text-white mb-6 mt-12 md:mt-28 "
            style={{
              fontFamily: "var(--font-vidaloka)",
              fontWeight: 500,
            }}
          >
            Get In Touch
          </h1>
          <p
            className="text-white text-[17px]"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            We would love to hear from you! Write to us, call us or just drop in
            for a cup of coffee.
          </p>
        </div>
      </section>
      {/* Main Card */}
      <div className="flex flex-col items-center justify-center sm:p-8 min-h-screen relative -top-10  md:-top-40">
        <div className="bg-white shadow-lg rounded-4xl sm:rounded-2xl overflow-hidden w-full sm:max-w-4xl mb-8">
          <div
            className="flex flex-col md:flex-row"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          >
            {/* Left Section */}
            <div className="bg-gray-200 px-6 py-16 sm:p-8 w-full md:w-1/2 text-base sm:text-lg flex flex-col justify-center">
              <h2
                className="text-[20px] md:text-[24px] mb-4 sm:mb-6 text-[#230745]"
                style={{ fontWeight: 500 }}
              >
                Visit Us
              </h2>
              <p className="mb-4 sm:mb-6 text-[16px] md:text-[20px] text-[#3A3B3B]">
                <strong className="text-[16px] md:text-[20px] text-[#230745]">
                  INDIA:
                </strong>{" "}
                B-203, Shyam Enclave, Opposite Apex Towers, Maninagar,
                Ahmedabad, Gujarat, India – 380008
              </p>
              <p className="mb-4 sm:mb-6 text-[16px] md:text-[20px] text-[#3A3B3B]">
                <strong className="text-[16px] md:text-[20px] text-[#230745]">
                  GLOBAL:
                </strong>{" "}
                19 West 38th Street, New York City, NY 10018, United States
              </p>
              <h2 className="font-semibold mb-4 sm:mb-6 text-[16px] md:text-[20px] text-[#230745]">
                Call Us
              </h2>
              <p className="mb-4 sm:mb-6 text-[16px] md:text-[20px] text-[#3A3B3B]">
                <strong className="text-[16px] md:text-[20px] text-[#230745]">
                  INDIA:
                </strong>{" "}
                +91 8092621301
              </p>
              <p className="mb-4 sm:mb-6 text-[16px] md:text-[20px] text-[#3A3B3B]">
                <strong className="text-[16px] md:text-[20px] text-[#230745]">
                  USA:
                </strong>{" "}
                +1 6469711794
              </p>
            </div>

            {/* Right Section */}
            <div className="bg-white p-6 sm:p-8 w-full md:w-1/2">
              <h2
                className="text-[26px] md:text-[38px] text-[#1A022D] mb-4 sm:mb-6 text-center"
                style={{
                  fontFamily: "var(--font-vidaloka)",
                  fontWeight: 500,
                }}
              >
                Write to us
              </h2>
              <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                message={modalMessage}
              />
              <form
                onSubmit={handleSubmit}
                className="space-y-4 text-[14px] md:text-[16px] text-[#242424]"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
              >
                {/* Name Input */}
                <div className="mb-4 sm:mb-6 ">
                  <label
                    htmlFor="name"
                    className="block text-gray-700 font-medium mb-2"
                  >
                    Name*
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-500"
                  />
                  {warning.name && (
                    <WarningMsg message="This field is required" />
                  )}
                </div>

                {/* Email Input */}
                <div className="mb-4 sm:mb-6">
                  <label
                    htmlFor="email"
                    className="block text-gray-700 font-medium mb-2"
                  >
                    Email*
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="example@mail.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-500"
                  />
                  {warning.mail && (
                    <WarningMsg message="This field is required" />
                  )}
                </div>

                {/* Phone Number Input */}
                <div className="mb-4 sm:mb-6">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Phone Number*{" "}
                      <span className="text-sm text-gray-500">
                        (with country code)
                      </span>
                    </label>
                    <div className="flex flex-row items-center border border-gray-300 rounded-md focus-within:ring-purple-500 focus-within:ring-2 transition-all duration-300">
                      <div className="relative w-auto">
                        <Select
                          instanceId="contact-us-country-code"
                          id="countryCode"
                          name="countryCode"
                          options={countryOptions}
                          onChange={handleCountryChange}
                          placeholder="Select"
                          styles={{
                            control: (base) => ({
                              ...base,
                              border: "none",
                              boxShadow: "none",
                              padding: "0",
                              minWidth: "120px",
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
                        type="number"
                        id="phone"
                        name="phone"
                        onChange={handleChange}
                        placeholder="Enter your Number"
                        className="flex-1 p-2 focus:outline-none"
                      />
                    </div>
                  </div>
                  {warning.phone && (
                    <WarningMsg message="This field is required" />
                  )}
                </div>

                {/* Message Input */}
                <div className="mb-4 sm:mb-6">
                  <label
                    htmlFor="message"
                    className="block text-gray-700 font-medium mb-2"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Write your message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-500"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    aria-label="Submit"
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-md shadow-md hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    Submit
                  </button>
                </div>
              </form>
              <p className="text-sm text-gray-500 mt-4 text-center">
                We’ll get back to you in 1-2 business days.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Section */}
        <div
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
          className="px-5 sm:px-0 flex flex-col sm:flex-row justify-center items-center gap-8 w-full max-w-5xl  my-5 sm:mt-10 tracking-wide"
        >
          {/* Email Us */}
          <div className="flex items-start gap-4 w-full sm:w-1/3">
            <div className="bg-orange-500 text-white p-2 rounded-md">
              <IoMdMail size={20} />
            </div>
            <div>
              <h3
                className="text-[20px] md:text-[22px]  text-[#1A022D] mb-3 md:mb-6"
                style={{ fontWeight: 500 }}
              >
                Email Us
              </h3>
              <p className="text-[16px] text-[#454545]">
                For any queries regarding our services, kindly send an e-mail
                to: info@gandharvaschoolofmusic.com
              </p>
            </div>
          </div>

          {/* Customer Support */}
          <div className="flex items-start gap-4 w-full sm:w-1/3 ">
            <div className="bg-orange-500 text-white p-2 rounded-md">
              <RiCustomerService2Fill size={20} />
            </div>
            <div>
              <h3
                className="text-[20px] md:text-[22px]  text-[#1A022D] mb-3 md:mb-6"
                style={{ fontWeight: 500 }}
              >
                Customer Support
              </h3>
              <p className="text-[16px] text-[#454545]">
                For any issue/escalation regarding our services, kindly send an
                e-mail to: info@gandharvaschoolofmusic.com
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p
          className="bg-[#FF9E00]  py-5  text-white text-[19px] md:text-[24px] text-center "
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
        >
          24/7 Dedicated Customer Support
        </p>
      </div>
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
