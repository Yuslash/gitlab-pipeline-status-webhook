import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const PROJECT_ID = '69686811'; // Replace with your actual project ID
const headers = { Authorization: `Bearer ${GITLAB_TOKEN}` };

// Function to get the latest pipeline
const getLatestPipeline = async () => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/latest`;
  console.log('🔍 Fetching latest pipeline...');
  const res = await axios.get(url, { headers });
  console.log('✅ Latest pipeline fetched:', res.data);
  return res.data.id;
};

// Function to get the jobs of a pipeline
const getJobs = async (pipelineId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`;
  console.log(`🔍 Fetching jobs for pipeline ID: ${pipelineId}...`);
  const res = await axios.get(url, { headers });
  console.log('✅ Jobs fetched:', res.data);
  return res.data;
};

// Function to get the trace log of a failed job
const getJobTrace = async (jobId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/jobs/${jobId}/trace`;
  console.log(`🔍 Fetching trace for job ID: ${jobId}...`);
  const res = await axios.get(url, { headers });
  console.log('✅ Job trace fetched:', res.data);
  return res.data;
};

// Webhook handler for POST requests
export default async function handler(req, res) {
  console.log('📬 Webhook received:', req.body);

  if (req.method === 'POST') {
    const event = req.body;

    // Only respond to pipeline events
    if (event.object_kind === 'pipeline') {
      console.log('📬 Pipeline status:', event.object_attributes.status);

      try {
        // Fetch latest pipeline, jobs, and job trace logs
        const pipelineId = await getLatestPipeline();
        const jobs = await getJobs(pipelineId);

        const failedJob = jobs.find(job => job.status === 'failed');
        if (failedJob) {
          console.log('🚨 A job failed. Fetching trace logs...');
          const trace = await getJobTrace(failedJob.id);
          console.log('🚨 Error log:', trace);
        } else {
          console.log('✅ All jobs passed');
        }
      } catch (err) {
        console.error('❌ Error fetching job logs:', err.response?.data || err.message);
      }
    }

    res.status(200).json({ message: 'Webhook received and processed' });
  } else {
    console.log('❌ Invalid method, only POST is allowed.');
    res.status(405).send('Method not allowed');
  }
}
